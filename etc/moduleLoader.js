const log = require('debug-logger')('module-loader');
const {config} = require('./guildConfig.js');
const moduleObj = require('./moduleObject.js');
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
const modules = new Map(), events = new emitter(), saved = new Map();

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

//need to modify this so that the file name is added to the object....
const initial = global.setupModule = (func) => {
	let mod;

	if (typeof func !== 'function') throw new Error('module function missing');
	func.call(mod = new moduleObj());
	log.info(time(), 'Module', mod.command, 'finished loading');
	modules.set(mod.command, mod);
	events.emit('loaded', mod);
}


function loadModule (file) {
	try {
		let fpath = path.resolve('modules', file);

		log.info(time(), 'Loading Module:', file);
		global.setupModule = (func) => {
			if (typeof func !== 'function') throw new Error('module function missing');
			func.call(mod = new moduleObj(fpath));
			log.info(time(), 'Module', mod.command, 'finished loading -', fpath);
			modules.set(mod.command, mod);
			events.emit('loaded', mod);
		}
		require(fpath);
	} catch (e) {
		log.error(time(), 'Unable to load module:', file, '::', e.toString());
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

//maybe put this all in a large async function, that is triggered by the main module?

module.exports.run = async () => {
	let dir;

	if (modules.size > 0) return modules;
	await loadConfig();
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
