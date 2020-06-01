const log = require('debug-logger')('module-loader');
const moduleObj = require('./moduleObject.js');
const {config} = require('./guildConfig.js');
const {time} = require('./utilities.js');
const {Client} = require('discord.js');
const emitter = require('events');
const fs = require('fs').promises;
const path = require('path');

const modules = new Map(), events = new emitter(), saved = new Map(), estEvents = new Set();
var bot;

Object.defineProperties(moduleObj.prototype, {
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

const initial = global.setupModule = () => {
	log.error(time(), 'Somehow function was called without loading a file?');
	throw new Error();
}

function loadModule (file) {
	try {
		let fpath = path.resolve('modules', file);

		log.info(time(), 'Loading Module:', file);
		global.setupModule = (func) => {
			let mod = new moduleObj(fpath, func, bot);//, ev = new emitter();
			if (typeof func !== 'function') throw new Error('module function missing');
			func.call(mod);
			log.info(time(), 'Module', mod.command, 'finished loading -', fpath);
			modules.set(mod.command, mod);
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

	if (input instanceof Client && !bot) {
		bot = input;
		await loadConfig();
	} else if (!bot) return;

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
