const log = require('debug-logger')('module-loader');
const moduleObj = require('./moduleObject.js');
const {config} = require('./guildConfig.js');
const {Client} = require('discord.js');
const emitter = require('events');
const time = require('./time.js');
const fs = require('fs').promises;
const path = require('path');

const sym = {
	name: Symbol('module command'),
	desc: Symbol('module description'),
	perm: Symbol('module permissions'),
	args: Symbol('module arguments'),
	gprm: Symbol('module guild specific perms'),
	gcmd: Symbol('module guild only'),
	exec: Symbol('module subroutine'),
	file: Symbol('file path for module'),
}
const modules = new Map(), events = new emitter(), saved = new Map(), estEvents = new Set();
var bot;

Object.defineProperties(moduleObj.prototype, {
	bot: {value: undefined, configurable: true},
	modules: {value: events},
	reload: {
		value: function () {
			delete require.cache[this.file];
			loadModule(this.file);
			global.setupModule = initial;
		}
	},
});

Object.defineProperty(config.prototype, 'saved', {
	value: function (param) {
		let temp = saved.get(this.id), res;

		if (temp) {
			res = temp[param];
			delete temp[param];
		}
		return res;
	}
});

//need to modify this so that the file name is added to the object....
const initial = global.setupModule = () => {
	log.error(time(), 'Somehow function was called without loading a file?');
	throw new Error();
}

function loadModule (file) {
	try {
		let fpath = path.resolve('modules', file);

		log.info(time(), 'Loading Module:', file);
		global.setupModule = (func) => {
			let mod = new moduleObj(fpath), ev = new emitter();
			if (typeof func !== 'function') throw new Error('module function missing');
			Object.defineProperty(mod, 'bot', {
				value: new Proxy(bot, {
					get (target, prop, prox) {
						if (prop in ev) {
							return ev[prop].bind(ev);
						} else return target[prop];
					}
				}),
			});
			ev.on('newListener', event => {
				if (!estEvents.has(event)) {
					if (bot) {
						bot.on(event, forwardEvent.bind(undefined, event));
					}
					estEvents.add(event);
				}
			});
			func.call(mod);
			log.info(time(), 'Module', mod.command, 'finished loading -', fpath);
			modules.set(mod.command, mod);
			ev.on('error', e => {
				log.error(time(), 'Listener for module', mod.command, 'resulted in an error:', e.toString());
				log.debug(e.stack);
			});
			events.emit('loaded', mod);
		}
		require(fpath);
	} catch (e) {
		log.error(time(), 'Unable to load module', file, ' successfully:', e.toString());
		log.debug(e.stack);
	}
}

async function loadConfig () {
	let dirPath = './data/', dir = await fs.readdir(dirPath, {encoding: 'utf8', withFileTypes: true});

	for (let file of dir) {
		if (file.isFile()) {
			try {
				let {id, ...conf} = require(path.join('../', dirPath, file.name));

				if (!id) id = file.name.substr(0, file.name.length - '.json'.length);
				saved.set(id, conf);
			} catch (e) {
				log.warn(time(), 'Unable to load config for', file.name);
				log.debug(e.stack);
			}
		}
	}
}

function forwardEvent(event, ...input) {
	for (let moduleObj of modules.values()) {
		try {
			moduleObj.bot.emit(event, ...input);
		} catch (e) {
			log.error(time(), 'uncaught listener error');
			log.error(e);
		}
	}
}

module.exports.run = async (input) => {
	let dir;

	if (input && input instanceof Client && !bot) {
		bot = input;
		if (estEvents.size) {
			for (let event of estEvents) {
				bot.on(event, forwardEvent.bind(undefined, event));
			}
		}
	}
	if (modules.size === 0) await loadConfig();
	dir = await fs.readdir('./modules', {encoding: 'utf8', withFileTypes: true});
	log.debug(time(), 'Found module files:', dir.length);
	for (let file of dir) {
		if (file.isFile()) loadModule(file.name);
	}
	global.setupModule = initial;
	events.emit('ready');
	return modules;
}

module.exports.modules = modules;
