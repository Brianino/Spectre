'use strict';

import ContextHandler from './ContextHandler.js';
import ModuleObject, { access } from './ModuleObject.js';
import { promises as fs, readFileSync } from 'fs';
import ConfigManager from './GuildConfig.js';
import * as Utils from '../utils/utils.js';
import * as discordjs from 'discord.js';
import timespan from 'timespan-parser';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import { inspect } from 'util';
import Path from 'path';
import vm from 'vm';

const log = logger('Module-Loader');
const cmdlog = logger('Commands');
// move iniTimeout to config, maybe add an option for timeout running a command?
const moduleFolder = '../modules', iniTimeout = 1000;
const __dirname = Path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync('./config.json'));

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
	Promise, Reflect, Proxy, Intl, WebAssembly, TextEncoder, TextDecoder,
	setImmediate, setInterval, setTimeout, URL, URLSearchParams, inspect,
	timespan: timespan('msec'), discordjs,

	// Utils
	Utils,

	// Bot config
	OwnerID: config.owner,
}

class ModuleLoader {
	#modules = new Map();
	#filePaths = new WeakMap();
	#confMan = new ConfigManager();
	#context;

	constructor () {
		this.#context = new ContextHandler(this.#confMan.getGuildConfig.bind(this.#confMan));
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
		input.on('guildCreate', async guild => {
			for (let mod of this.#modules.values()) {
				try {
					await this.#context.getContext(mod).getGuildContext(guild);
				} catch (e) {
					log.warn('Failed to instantiate command', mod.command, 'on guild', guild.id, e);
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
		else if (mod instanceof ModuleObject === false)
			throw new Error('Need either a module object, or a module name');
		this.#context.cleanup(mod);
		this.modules.delete(mod.command);
		return this.#loadModule({filePath: this.#filePaths.get(mod), group: mod.group});
	}

	async runCommand (msg) {
		let [cmdStr, ...msgStr] = msg.content.split(' '), config = this.#confMan.getGuildConfig(msg.guild?.id), cmd;

		if (!cmdStr.startsWith(config.prefix))
			return;
		cmd = this.modules.get(cmdStr.substr(config.prefix.length));

		log.debug('Has guild?', msg.guild && true);
		if (cmd && access.call(cmd, msg.author, msg.guild, config)) {
			let ctx = this.#context.getContext(cmd);
			if (msg.guild) { //this creates instance, it doens't run the fun, return value needs to be run;
				cmdlog.info(`User ${msg.author.username} (${msg.author.id}) is running command ${cmd.command} on server ${msg.guild.name} (${msg.guild.id})`);
				return (await ctx.getGuildContext(msg.guild)).call(config, msg, ...msgStr);
			} else {
				cmdlog.info(`User ${msg.author.username} (${msg.author.id}) is running command ${cmd.command} in direct messages`);
				return (await ctx.getDMContext()).call(config, msg, ...msgStr);
			}
		}
	}

	async #loadModule ({filePath, group}, inst = true) {
		log.debug('Attempting to load module:', filePath, group);
		try {
			let {name, code} = await this.#loadFile(filePath), mod;

			if (this.modules.has(name))
				return log.debug('Skipping over existing module', name);
			if (code.startsWith('skip_me'))
				return log.warn('Skip requested by', name);
			this.modules.set(name, mod = await this.#setupModule(name, group, filePath, code));
			this.#filePaths.set(mod, filePath);
			if (this.source && inst)
				await this.#instGuildCtx(mod);
			log.info(name, 'Module instantiated');
		} catch (e) {
			log.error('Unable to setup module:', filePath);
			try { // To deal with special errors from the vm context
				log.error(e);
			} catch (ignore) {
				log.warn(ignore); // Reason error couldn't be logged as an error
				log.error(e.toString());
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

	async #instGuildCtx (mod) {
		for (let guild of this.source.guilds.cache.values()) {
			try {
				await this.#context.getContext(mod).getGuildContext(guild);
			} catch (e) {
				log.warn('Failed to instantiate command', mod.command, 'on guild', guild.id);
				log.warn(e);
			}
		}
		try {
			await this.#context.getContext(mod).getDMContext();
		} catch (e) {
			log.warn('Failed to instantiate command', mod.command, 'dm context');
			log.warn(e);
		}
	}

	#proxifyModule (mod, main) {
		return new Proxy (main, {
			get: (target, prop) => {
				if (Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(mod), prop)){
					let val = Reflect.get(mod, prop);
					if (val instanceof Function)
						return val.bind(mod);
					else
						return val;
				} else {
					return Reflect.get(target, prop);
				}
			},
			set: (target, prop, value) => {
				if (Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(mod), prop))
					return Reflect.set(mod, prop, value);
				else
					return Reflect.set(target, prop, value);
			},
			apply: (target, thisArg, args) => {
				log.info("Apply called:");
				return Reflect.apply(target, thisArg, args);
			}
		});
	}

	async #setupModule (name, group, filename, code) {
		let script = new vm.Script(code, {filename}), obj = new ModuleObject(name, group),
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
			access: access,
			log: logger(`Module-${group}`),
			getBot: () => this.source,
			getConfigurable: () => this.#confMan.getConfigurable(),
			addConfig: (varName, type, {description, configurable, ...props}) => {
				log.debug('Adding config for', name, varName);
				this.#confMan.register(varName, type, {description, configurable, ...props});
				if (configurable) {
					vars.push(varName);
				}
				log.debug('Config added for', name, varName);
			},
		}, globals);
		script.runInNewContext(this.#proxifyModule(obj, ctx), {contextName: `Main Context: ${name}`, timeout: iniTimeout});
		this.#context.create(obj, ctx);
		return obj;
	}
}

export { ModuleLoader as default };
