const log = require('debug-logger')('module-loader');
const {Permissions, Guild, Client} = require('discord.js');
const emitter = require('events');
const time = require('./time.js');
const fs = require('fs').promises;
const path = require('path');

const sym = {
	name: Symbol('module command'),
	desc: Symbol('module description'),
	perm: Symbol('module permissions'),
	gprm: Symbol('module guild specific perms'),
	gcmd: Symbol('module guild only'),
	exec: Symbol('module subroutine'),
	file: Symbol('file path for module'),
}
const modules = new Map(), events = new emitter();

module.exports = function (input) {
	if (!exports.bot && input instanceof Client) exports.bot = input;
	return {
		exec: sym.exec,
		modules: modules,
	}
}
module.exports.exec = sym.exec;
module.exports.modules = modules;
require('./guildConfig.js')(modules);

fs.readdir(path.join('./', 'modules'), {
	encoding: 'utf8',
	withFileTypes: true,
}).then(files => {
	log.debug(time(), 'Found files:', files.length);
	for (let file of files) {
		log.info(time(), 'Loading Module:', files.name);
		try {
			if (file.isFile()) require(path.join('../', 'modules', file.name));
		} catch (e) {
			log.error(time(), 'Unable to load module:', file.name, '::', e.toString());
			log.debug(e.stack);
		}
	}
	events.emit('ready');
}).catch(e => {
	log.error(time(), 'Unable to load modules:', e.toString());
});

//need to modify this so that the file name is added to the object....
global.setupModule = (func) => {
	let mod;
	/* May be used later to group commands into "modules"
	if (!func) {
		func = command;
		command = '';
	}*/
	if (typeof func !== 'function') throw new Error('module function missing');
	func.call(mod = new cmdmodule());
	log.info(time(), 'Module', mod.command, 'finished loading');
	modules.set(mod.command, mod);
	events.emit('loaded', mod);
}

class cmdmodule {
	constructor (file) {
		Object.defineProperties(this, {
			[sym.name]: {writable: true, value: null},
			[sym.desc]: {writable: true, value: null},
			[sym.exec]: {writable: true, value: null},
			[sym.gcmd]: {writable: true, value: true},
			[sym.gprm]: {writable: true, value: new Map()},
			[sym.perm]: {writable: true, value: new Permissions('VIEW_CHANNEL')},
			[sym.file]: {value: file},
			bot: {value: exports.bot},
			modules: {value: events},
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
		value = String(value);
		this[sym.name] = value.replace(/ /g, '');
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
	 * @param value the permissions required to run the command, will be displayed in the specific help
	*/
	set permissions (value) {
		if (this[sym.desc]) log.warn(time(), 'permission for', this[sym.name], 'was modified');
		this[sym.perm] = new Permissions(value);
	}

	get permissions () {
		return (guild, ...perms) => {
			if (perms.length) {
				let tmp = null;
				if (!guild instanceof Guild) throw new Error('First argument of permissions should be a guild');
				if (perms.length === 1) perms = perms[0];
				if (perms instanceof Array && perms.length === 0) {
					this[sym.gprm].delete(guild);
					log.warn(time(), 'Permissions for', guild.name, 'was set to default');
				} else {
					this[sym.gprm].set(guild, tmp = new Permissions(perms));
					log.warn(time(), 'Permissions for', guild.name, 'was modified to', tmp.toArray().join(' '));
				}
			} else if (guild) {
				return this[sym.gprm].get(guild) || this[sym.perm];
			} else {
				return this[sym.perm];
			}
		}
	}

	/*
	 * @param value the permissions required to run the command, will be displayed in the specific help
	*/
	set guildOnly (value) {
		if (this[sym.desc]) log.warn(time(), 'guild only flag for', this[sym.name], 'was modified');
		this[sym.gcmd] = Boolean(value);
	}

	get guildOnly () {
		return this[sym.gcmd];
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
