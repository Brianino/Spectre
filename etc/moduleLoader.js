const log = require('debug-logger')('module-loader');
const {prefix} = require('../config.json');
const time = require('./time.js');
const fs = require('fs').promises;
const path = require('path');

const sym = {
	name: Symbol('module command'),
	desc: Symbol('module description'),
	exec: Symbol('module subroutine'),
	file: Symbol('file path for module'),
}
const modules = module.exports = new Map();

fs.readdir(path.join('./', 'modules'), {
	encoding: 'utf8',
	withFileTypes: true,
}).then(files => {
	log.debug('Found files:', files);
	for (let file of files) {
		try {
			if (file.isFile()) require(path.join('../', 'modules', file.name));
		} catch (e) {
			log.error(time(), 'Unable to load module:', file.name, '::', e.toString());
			log.debug(e.stack);
		}
	}
}).catch(e => {
	log.error(time(), 'Unable to load modules:', e.toString());
})

//need to modify this so that the file name is added to the object....
global.setupModule = (command = "", func) => {
	let mod;
	if (!func) {
		func = command;
		command = '';
	}
	if (typeof func !== 'function') throw new Error('module function missing');
	func.call(mod = new cmdmodule());
	log.info(time(), 'Module', mod.command, 'finished loading');
	modules.set(mod.command, mod);
}

bot.on('message', msg => new Promise((resolve, reject) => {
	let msgStr = msg.content.split(' ');
	let cmd = modules.get(msgStr[0].substr(1));

	msgStr.shift();
	log.debug(time(), 'Found cmd:', cmd !== undefined, 'Message:', msg.content);
	if (cmd && msg.content.startsWith(prefix)) return cmd[sym.exec](msg, ...msgStr);
	return;
}).catch(e => {
	log.error(time(), 'There was an error executing a command', e.toString());
	log.error(e.stack);
}));

class cmdmodule {
	constructor (file) {
		Object.defineProperties(this, {
			[sym.name]: {writable: true, value: null},
			[sym.desc]: {writable: true, value: null},
			[sym.exec]: {writable: true, value: null},
			[sym.file]: {value: file},
		});
	}

	/*
	 * This should only really be used by the module loader, for the purpuse of allowing a reload (it knows which file to reload)
	*/
	get file () {
		return this[sym.file];
	}

	/*
	 * @param value takes a string input to use as the command, should not contain a space
	*/
	set command (value) {
		if (this[sym.name]) throw new Error('command already set, and cannot be changed');
		this[sym.name] = String(value);
	}

	get command () {
		return this[sym.name];
	}

	/*
	 * @param value the description of the module, will be displayed in the specific help
	*/
	set description (value) {
		if (this[sym.desc]) log.warn(time(), 'description for', this[sym.name], 'was modified');
		this[sym.desc] = String(value);
	}

	get description () {
		return this[sym.desc];
	}

	/*
	 * @param func a function to run when the command is called
	*/
	exec (func) {
		if (typeof func !== 'function') {
			log.warn('Function not set for', this[sym.name]);
		} else {
			this[sym.exec] = func;
		}
	}
}
