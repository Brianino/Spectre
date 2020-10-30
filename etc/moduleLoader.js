'use strict';

const logger = require('./logger.js');
const contextHandler = require('./contextHandler.js');
const modObj = require('./moduleObject.js');
const log = logger('module-loader');
// guild config
const {promises:fs} = require('fs');
const Path = require('path');
const vm = require('vm');

const eventEmitter = require('events');
// move iniTimeout to config, maybe add an option for timeout running a command?
const moduleFolder = '../test', iniTimeout = 1000, modules = new Map();

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
}

const context = new contextHandler();

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

async function loadFile (filePath, group) {
	let name = Path.basename(filePath, '.js');

	if (!filePath.endsWith('.js'))
		throw new Error('Unknown file type');
	return {
		name: name,
		group: group,
		filename: filePath,
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

async function getModules () {
	let files = await findModules();

	return await Promise.all(files.map(file => {
		return loadFile(file.filePath, file.group).catch(e => {
			log.error('Error occured loading module', file.filePath);
			return undefined;
		});
	}));
}

function setupModule (name, group, filename, code) {
	let script = new vm.Script(code, {filename}), obj = new modObj(name, group), temp = {}, ctx = Object.create(temp);

	Object.assign(temp, {__filename: filename, __dirname: Path.dirname(filename), setupModule: ctx}, globals);
	try {
		script.runInNewContext(proxifyModule(obj, ctx), {contextName: 'Main Context: ' + name, timeout: iniTimeout});
		log.info('Module instantiated, Creating module context objects');
		context.create(obj, ctx);
		modules.set(name, obj);
	} catch (e) {
		log.error('Unable to setup module', name);
		if ('stack' in e) log.error(e.stack);
		else log.error(e.toString());
	}
}

const evEmitter = new eventEmitter();

getModules().then(input => {
	for (let mod of input) {
		log.info('Processing:', mod.filename);
		if (mod) setupModule(mod.name, mod.group, mod.filename, mod.code);
	}
	return modules[Symbol.iterator]();
}).then(att => {
	context.setEventSource(evEmitter);
	let [,mod] = att.next().value;

	log.trace('one');
	if (!mod) throw new Error('Map is empty');
	log.trace('two');
	let func = mod[context.getDMSymbol]();
	log.trace('three', typeof func);
	// This should hopfully be the function isolated in its own context? verify by running 2 times?
	log.log('Start:', func());
	log.trace('four');
	log.log('Modified:', func('New Value'));
	log.log('End:', func());
	return att;
}).then(att => {
	let [,mod] = att.next().value;

	if (!mod) return log.log('Nothing in second');
	let func = mod[context.getDMSymbol]();

	log.log('Start:', func());
	log.log('Modified:', func('Other Value'));
	log.log('End:', func());

	let guildx = mod[context.getGuildSymbol]('x');
	let guildy = mod[context.getGuildSymbol]('y');

	log.log('Start x:', guildx());
	log.log('Start y:', guildy());
	log.log('Modified x:', guildx('Guild X'));
	log.log('Same y:', guildy());
	log.log('Modified y:', guildy('Guild Y'));
	log.log('End x:', guildx());
	log.log('End y:', guildy());
	return att;
}).then(() => {
	evEmitter.emit('test');
	evEmitter.emit('test2', {guild: {id: 'x'}, name: 'some guild x'});
}).catch(e => {
	console.error('There was an error:', e.toString());
	console.error(e.stack);
});
