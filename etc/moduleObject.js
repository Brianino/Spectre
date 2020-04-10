const log = require('debug-logger')('module-loader');
const {config, saved, register} = require('./guildConfig.js');
const {promises:fs, constants} = require('fs');
const {Permissions} = require('discord.js');
const time = require('./time.js');

const sym = {
	name: Symbol('command name'),
	desc: Symbol('command description'),
	extd: Symbol('Command indepth description'),
	gcmd: Symbol('module guild only'),
	exec: Symbol('module subroutine'),
	args: Symbol('command arguments'),
	perm: Symbol('command permissions'),
	file: Symbol('file'),

}

module.exports = class module {
	constructor (file) {
		Object.defineProperties(this, {
			[sym.name]: {writable: true, value: null},
			[sym.desc]: {writable: true, value: null},
			[sym.extd]: {writable: true, value: null},
			[sym.gcmd]: {writable: true, value: true},
			[sym.exec]: {writable: true, value: null},
			[sym.args]: {writable: true, value: []},
			[sym.perm]: {writable: true, value: new Permissions('VIEW_CHANNEL')},
			[sym.file]: {value: file},
			bot: {value: exports.bot},
		});
	};

	get file () {
		return this[sym.file];
	}

	configVar (name, type, defaultVal, func) {
		return register(name, type, defaultVal, func);
	}

	config (guildid) {
		let res = saved.get((typeof guildid === 'string') ? guildid: guildid = guildid.id);
		if (!res) saved.set(guildid, res = new config(guildid));

		return res;
	}

	set command (value) {
		if (this[sym.name]) throw new Error('command already set, and cannot be changed');
		value = String(value);
		this[sym.name] = value.replace(/ /g, '');
	}

	get command () {return this[sym.name]}

	set description (value) {
		if (this[sym.desc]) log.warn(time(), 'description for', this[sym.name], 'was modified');
		this[sym.desc] = String(value);
	}

	get description () {return this[sym.desc]}

	set extraDesc (value) {
		if (this[sym.desc]) log.warn(time(), 'description for', this[sym.name], 'was modified');
		this[sym.desc] = String(value);
	}

	get extraDesc () {return this[sym.desc]}

	set arguments (value) {
		if (this[sym.args]) log.warn(time(), 'arguments help for', this[sym.name], 'was modified');
		this[sym.args].push(String(value));
	}

	get arguments () {return this[sym.args]}

	set permissions (value) {
		if (this[sym.desc]) log.warn(time(), 'permission for', this[sym.name], 'was modified');
		this[sym.perm] = new Permissions(value);
	}

	get permissions () {
		return (guildid) => {
			if (guildid) {
				let config = this.config(guildid);

				return config.permissions || this[sym.perm];
			}
			return this[sym.perm];
		}
	}

	set guildOnly (value) {
		if (this[sym.desc]) log.warn(time(), 'guild only flag for', this[sym.name], 'was modified');
		this[sym.gcmd] = Boolean(value);
	}

	get guildOnly () {return this[sym.gcmd]}

	exec (func) {
		if (typeof func !== 'function') {
			log.warn('Function not set for', this[sym.name]);
		} else {
			this[sym.exec] = func;
		}
	}

	async run (msg, ...params) {
		//for now just run command, but check perms and enabled status...
		let tmp = this.config(msg.guild.id);
		log.debug(time(), tmp.constructor.name, tmp.toJsonObj());
		return this[sym.exec](msg, ...params);
	}

	reload () {}

}
