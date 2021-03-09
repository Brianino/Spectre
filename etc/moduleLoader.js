'use strict';

const logger = require('../utils/logger.js');
const contextHandler = require('./contextHandler.js');
const configManager = require('./guildConfig.js');
const modObj = require('./moduleObject.js');
const time = require('../utils/time.js');
const {promises:fs} = require('fs');
const Path = require('path');
const vm = require('vm');

const log = logger('module-loader');
// move iniTimeout to config, maybe add an option for timeout running a command?
const moduleFolder = '../modules', iniTimeout = 1000;

const globals = { // TODO: Lock off objects so that they can't be modified from within the module
	// Value Globals
	Infinity, NaN, undefined,

	// Function Globals
	eval, isFinite, isNaN, parseFloat, parseInt, encodeURI, encodeURIComponent, decodeURI, decodeURIComponent,

	// Fundamental Objects
	Object, Function, Boolean, Symbol,

	// Error Objects
	Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError,

	// Numbers and dates
	Number, BigInt, Math, Date,

	// Text processing
	String, RegExp,

	// Indexed collections
	Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
	Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array,

	// Keyed collections
	Map, Set, WeakMap, WeakSet,

	// Structured data
	ArrayBuffer, SharedArrayBuffer, Atomics, DataView, JSON,

	// Other
	Promise, Reflect, Proxy, Intl, WebAssembly, require, logger, TextEncoder,
	setImmediate, setInterval, setTimeout, URL, URLSearchParams, TextDecoder,
	time,
}

module.exports = class moduleLoader {
	#modules = new Map();
	#filePaths = new WeakMap();
	#confMan = new configManager();
	#context;

	constructor () {
		this.#context = new contextHandler(this.#confMan.getGuildConfig.bind(this.#confMan));
	}

	get modules () {
		// change this to return a bunch of proxies that can be used to indirectly read the properties on the commands
		return this.#modules;
	}

	get register () {
		return this.#confMan.register.bind(this.#confMan);
	}

	set source (input) {
		this.#context.setEventSource(input);
		Object.defineProperty(this, 'source', {get () {return input}});

		if (this.modules.size)
			this.modules.forEach(mod => this.#instGuildCtx(mod));
		input.on('guildCreate', guild => {
			for (let mod of this.#modules.values()) {
				try {
					mod[contextHandler.guildSymbol](guild.id);
				} catch (e) {
					log.warn('Failed to instantiate command', mod.command, 'on guild', guild.id);
					log.file['module-loader']('WARN - Failed to instantiate command', mod.command, 'on guild', guild.id);
					log.file['module-loader']('WARN - ', e);
				}
			}
		});
	}

	async setup () {
		let files = await this.#findModules(), res;

		res = await Promise.allSettled(files.map(file => this.#loadModule(file, false)));
		await this.#confMan.loadConfig();
		if (this.source)
			this.modules.forEach(mod => this.#instGuildCtx(mod));
		res = res.filter(val => val.status === 'rejected');
		if (res.length)
			log.warn(res);
	}

	reload (mod) {
		if (typeof mod === 'string')
			mod = this.modules.get(mod);
		else if (mod instanceof modObj === false)
			throw new Error('Need either a module object, or a module name');
		this.#context.cleanup(mod);
		this.modules.delete(mod.command);
		return this.#loadModule({filePath: this.#filePaths.get(mod), group: mod.group});
	}

	runCommand (msg) {
		let [cmdStr, ...msgStr] = msg.content.split(' '), config = this.#confMan.getGuildConfig(msg.guild?.id), cmd;

		if (!cmdStr.startsWith(config.prefix))
			return;
		cmd = this.modules.get(cmdStr.substr(config.prefix.length));

		if (cmd && modObj.access.call(cmd, msg.author, msg.guild, config)) {
			if (msg.guild) //this creates instance, it doens't run the fun, return value needs to be run;
				return cmd[contextHandler.guildSymbol](msg.guild.id).call(config, msg, ...msgStr);
			else
				return cmd[contextHandler.DMSymbol]().call(config, msg, ...msgStr);
		}
	}

	async #loadModule ({filePath, group, mname}, inst = true) {
		log.debug('Attempting to load module:', filePath, group);
		try {
			let {name, code} = await this.#loadFile(filePath), mod;

			if (this.modules.has(name))
				return log.debug('Skipping over exiting module', name);
			this.modules.set(name, mod = this.#setupModule(name, group, filePath, code));
			this.#filePaths.set(mod, filePath);
			if (this.source && inst)
				this.#instGuildCtx(mod);
			log.info(name, 'Module instantiated');
		} catch (e) {
			log.error('Unable to setup module:', filePath);
			try {
				log.error(e);
				log.file['module-loader']('ERROR - Unable to set up module:', e);
			} catch (ignore) {
				log.error(e.toString());
				log.file['module-loader']('ERROR - Unable to set up module:', e.toString());
			}
		}
	}

	async #loadFile (filePath) {
		let name = Path.basename(filePath, '.js');

		if (!filePath.endsWith('.js'))
			throw new Error('Unknown file type');
		return {
			name: name,
			code: await fs.readFile(filePath, {encoding: 'utf8'})
		};
	}

	async #findModules () {
		let res = [], path = Path.resolve(__dirname, moduleFolder);
		for await (let item of await fs.opendir(path)) {
			if (item.isFile()) {
				res.push({
					filePath: Path.resolve(path, item.name),
					group: 'Other'
				});
			} else if (item.isDirectory()) {
				let group = item.name, newPath = Path.resolve(path, item.name);

				for await (let modItem of await fs.opendir(newPath)) {
					if (modItem.isFile()) {
						res.push({
							filePath: Path.resolve(newPath, modItem.name),
							group: group
						});
					}
				}
			}
		}
		return res;
	}

	#instGuildCtx (mod) {
		for (let {id} of this.source.guilds.cache.values()) {
			try {
				mod[contextHandler.guildSymbol](id);
			} catch (e) {
				log.warn('Failed to instantiate command', mod.command, 'on guild', id);
				log.warn(e);
			}
		}
		try {
			mod[contextHandler.DMSymbol]();
		} catch (e) {
			log.warn('Failed to instantiate command', mod.command, 'dm context');
			log.warn(e);
		}
	}

	#proxifyModule (mod, main) {
		return new Proxy (main, {
			get: (target, prop, receiver) => {
				if (Object.getPrototypeOf(mod).hasOwnProperty(prop))
					return Reflect.get(mod, prop);
				else
					return Reflect.get(target, prop);
			},
			set: (target, prop, value, receiver) => {
				if (Object.getPrototypeOf(mod).hasOwnProperty(prop))
					return Reflect.set(mod, prop, value);
				else
					return Reflect.set(target, prop, value);
			},
		});
	}

	#setupModule (name, group, filename, code) {
		let script = new vm.Script(code, {filename}), obj = new modObj(name, group),
			temp = {}, ctx = Object.create(temp), vars = [];

		if (name === 'reload') {
			temp.loadNew = this.setup.bind(this);
			temp.reload = this.reload.bind(this);
		}
		Object.defineProperties(obj, {
			'vars': {get () {return [...vars]}}
		});
		Object.assign(temp, {
			__filename: filename,
			__dirname: Path.dirname(filename),
			setupModule: this.#proxifyModule(obj, ctx),
			modules: this.modules,
			access: modObj.access,
			getBot: () => this.source,
			getConfigurable: () => this.#confMan.getConfigurable(),
			log: logger('Module-' + group + '-' + name),
			addConfig: (varName, type, {description, configurable, ...props}) => {
				log.debug('Adding config for', name, varName);
				this.#confMan.register(varName, type, {description, configurable, ...props});
				if (configurable) {
					vars.push(varName);
				}
				log.debug('Config added for', name, varName);
			},
		}, globals);
		script.runInNewContext(this.#proxifyModule(obj, ctx), {contextName: 'Main Context: ' + name, timeout: iniTimeout});
		return this.#context.create(obj, ctx);
	}
}
