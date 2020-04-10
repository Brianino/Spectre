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
	lcmd: Symbol('module access limitations'),
	args: Symbol('command arguments'),
	perm: Symbol('command permissions'),
	exec: Symbol('module subroutine'),
	file: Symbol('file'),

}

module.exports = class module {
	constructor (file) {
		Object.defineProperties(this, {
			[sym.file]: {value: file},
			[sym.name]: {writable: true, value: null},
			[sym.desc]: {writable: true, value: null},
			[sym.extd]: {writable: true, value: null},
			[sym.gcmd]: {writable: true, value: true},
			[sym.args]: {writable: true, value: []},
			[sym.perm]: {writable: true, value: new Permissions('VIEW_CHANNEL')},
			[sym.exec]: {writable: true, value: null},
			[sym.lcmd]: {writable: false, value: new Map([['users', []],['guilds', []]])},
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
		if (this[sym.extd]) log.warn(time(), 'description for', this[sym.name], 'was modified');
		this[sym.extd] = String(value);
	}

	get extraDesc () {return this[sym.extd]}

	set arguments (value) {
		if (this[sym.args]) log.warn(time(), 'arguments help for', this[sym.name], 'was modified');
		this[sym.args].push(String(value));
	}

	get arguments () {return this[sym.args]}

	set permissions (value) {
		log.info(time(), 'permission for', this[sym.name], 'was set');
		this[sym.perm] = new Permissions(value);
	}

	get permissions () {
		return (guildid) => {
			if (guildid) {
				let config = this.config(guildid);

				return config.permissions(this.command) || this[sym.perm];
			}
			return this[sym.perm];
		}
	}

	set guildOnly (value) {
		if (this[sym.desc]) log.warn(time(), 'guild only flag for', this[sym.name], 'was modified');
		this[sym.gcmd] = Boolean(value);
	}

	get guildOnly () {return this[sym.gcmd]}

	set limit ([type, ...ids]) {
		if (this[sym.lcmd].has(type)) this[sym.lcmd].set(type, ids);
	}

	access (user, guild) {
		let users = this[sym.lcmd].get('users'), guilds = this[sym.lcmd].get('guilds');

		if (guild) {
			let config = this.config(guild.id), gUser = guild.members.cache.get(user.id);
			if (gUser && !gUser.permissions.has(this.permissions(guild.id))) return false;
			if (guilds.length && guilds.indexOf(guild.id) < 0) return false;
			if (config.disabled.has(this.command)) return false;
		} else {
			if (guilds.length) return false;
		}
		if (users.length && users.indexOf(user.id) < 0) return false;
		return true;
	}

	exec (func) {
		if (typeof func !== 'function') {
			log.warn('Function not set for', this[sym.name]);
		} else {
			this[sym.exec] = func;
		}
	}

	async run (msg, cmd, ...params) {
		//for now just run command, but check perms and enabled status...
		let tmp = this.config(msg.guild.id), users = this[sym.lcmd].get('users');

		if (!cmd.startsWith(tmp.prefix)) return;
		log.debug('Prefix matches, continuing check');
		if (msg.author.bot) return log.info('ignoring bot');
		if (users.length > 0 && users.indexOf(msg.author.id) < 0) return;
		if (msg.member) {
			let user = msg.member, guilds = this[sym.lcmd].get('guilds');

			if (guilds.length && guilds.indexOf(msg.guild.id) < 0) return;
			if (tmp.disabled.has(this.command)) return;
			if (!user.permissionsIn(msg.channel).has(this.permissions(msg.guild.id)))
				return log.warn(time(), 'User missing permissions for', this.command);

			return this[sym.exec](msg, ...params);
		} else {
			if (!this.guildOnly) return this[sym.exec](msg, ...params);
		}
	}

	reload () {}

}
