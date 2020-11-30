'use strict';

const logger = require('./logger.js');
const contextHandler = require('./contextHandler.js');
const configManager = require('./guildConfig.js');
const modObj = require('./moduleObject.js');
const {time} = require('./utilities.js');
const log = logger('module-loader');
const {promises:fs} = require('fs');
const Path = require('path');
const vm = require('vm');

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

function proxifyModule (mod, main) {
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

async function loadFile (filePath) {
	let name = Path.basename(filePath, '.js');

	if (!filePath.endsWith('.js'))
		throw new Error('Unknown file type');
	return {
		name: name,
		code: await fs.readFile(filePath, {encoding: 'utf8'})
	};
}

async function findModules () {
	let res = [], path = Path.resolve(__dirname, moduleFolder);
	for await (let item of await fs.opendir(path)) {
		if (item.isFile()) {
			res.push({
				filePath: Path.resolve(path, item.name),
				group: 'other'
			});
		} else if (item.isDirectory()) {
			let group = item.name, newPath = Path.resolve(path, item.name);

			for await (let modItem of await fs.opendir(newPath)) {
				if (item.isFile()) {
					res.push({
						filePath: Path.resolve(newPath, item.name),
						group: group
					});
				}
			}
		}
	}
	return res;
}

function setupModule (name, group, filename, code) {
	let script = new vm.Script(code, {filename}), obj = new modObj(name, group), temp = {}, ctx = Object.create(temp);

	Object.assign(temp, {
		__filename: filename,
		__dirname: Path.dirname(filename),
		setupModule: proxifyModule(obj, ctx),
		addConfig: this.register,
		modules: this.modules,
		getBot: () => this.source,
		log: logger('Module-' + group + '-' + name),
	}, globals);
	script.runInNewContext(proxifyModule(obj, ctx), {contextName: 'Main Context: ' + name, timeout: iniTimeout});
	return this[sym.context].create(obj, ctx);
}

const sym = {
	modules: Symbol('modules map'),
	context: Symbol('context handler'),
	gconfig: Symbol('guild config manager'),
}

module.exports = class moduleLoader {
	constructor () {
		let config;
		Object.defineProperties(this, {
			[sym.modules]: {value: new Map()},
			[sym.gconfig]: {value: config = new configManager()},
			[sym.context]: {value: new contextHandler(config.getGuildConfig.bind(config))},
		});
	}

	get modules () {
		// change this to return a bunch of proxies that can be used to indirectly read the properties on the commands
		return this[sym.modules]
	}

	get register () {
		return this[sym.gconfig].register.bind(this[sym.gconfig]);
	}

	async loadModule ({filePath, group}) {
		log.debug('Attempting to load module:', filePath, group);
		try {
			let {name, code} = await loadFile(filePath);

			this[sym.modules].set(name, setupModule.call(this, name, group, filePath, code));
			log.info(name, 'Module instantiated');
		} catch (e) {
			log.error('Unable to setup module:', file.filePath);
			try {
				log.error(e);
				log.file['module-loader']('Unable to set up module:', e);
			} catch (ignore) {
				log.error(e.toString());
				log.file['module-loader']('Unable to set up module:', e.toString());
			}
		}
	}

	async setup () {
		let files = await findModules();

		await Promise.allSettled(files.map(file => this.loadModule(file)));
	}

	set source (input) {
		this[sym.context].setEventSource(input);
		Object.defineProperty(this, 'source', {get () {return input}});
	}

	runCommand (msg) {
		let [cmdStr, ...msgStr] = msg.content.split(' '), config = this[sym.gconfig].getGuildConfig(msg.guild?.id), cmd;

		if (!cmdStr.startsWith(config.prefix))
			return;
		cmd = this[sym.modules].get(cmdStr.substr(config.prefix.length));

		if (cmd && modObj.access.call(cmd, msg.author, msg.guild, config)) {
			if (msg.guild) //this creates instance, it doens't run the fun, return value needs to be run;
				return cmd[contextHandler.guildSymbol](msg.guild.id).call(config, msg, ...msgStr);
			else
				return cmd[contextHandler.DMSymbol]().call(config, msg, ...msgStr);
		}
	}
}
