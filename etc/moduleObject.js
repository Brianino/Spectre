const log = require('debug-logger')('module-object');
const {config, saved, register} = require('./guildConfig.js');
const {Permissions, Guild, Message, Collection} = require('discord.js');
const emitter = require('events');
const time = require('./time.js');

const sym = {
	name: Symbol('command name'),
	desc: Symbol('command description'),
	extd: Symbol('Command indepth description'),
	gcmd: Symbol('module guild only'),
	lcmd: Symbol('module access limitations'),
	args: Symbol('command arguments'),
	conf: Symbol('configurable settings'),
	perm: Symbol('command permissions'),
	exec: Symbol('module subroutine'),
	func: Symbol('Creation function'),
	file: Symbol('module file path'),
	imap: Symbol('internal map'),
	ivar: Symbol('internal variable'),
}

class reqError extends Error {} // An error that should occur whenever a command is missing a precondition to run;

class moduleObj {
	constructor (bot, evHandler) {
		let ev = new emitter();
		Object.defineProperties(this, {
			[sym.name]: {writable: true, value: null},
			[sym.desc]: {writable: true, value: null},
			[sym.extd]: {writable: true, value: null},
			[sym.gcmd]: {writable: true, value: true},
			[sym.args]: {writable: true, value: []},
			[sym.conf]: {writable: true, value: []},
			[sym.perm]: {writable: true, value: new Permissions('VIEW_CHANNEL')},
			[sym.lcmd]: {writable: false, value: new Map([['users', []],['guilds', []]])},
			[sym.exec]: {writable: true, value: null},
			bot: { //move to module part so that each server intance has its own ev object
				value: new Proxy(bot, {
					get (target, prop, prox) {
						if (prop in ev) target = ev;
						return Reflect.get(target, prop);
					}
				}),
				configurable: true,
			}
		});
		ev.on('newListener', (event, func) => {
			if (ev.listenerCount(event) == 0) {
				if (evHandler) evHandler.on(event, func);
				else bot.on(event, this.bot.emit.bind(undefined, event));
			}
		});
	};

	get vars () {
		return [...this[sym.conf]];
	}

	addConfig (name, type, defaultVal, userEditable, desc) {
		let conf = register(name, type, defaultVal, userEditable, desc);
		if (conf) this[sym.conf].push(name);
	}

	set command (value) {
		if (this[sym.name]) throw new Error('command already set, and cannot be changed');
		value = String(value);
		this[sym.name] = value.replace(/ /g, '');
	}

	get command () {return this[sym.name]}

	set description (value) {
		this[sym.desc] = String(value);
	}

	get description () {return this[sym.desc]}

	set extraDesc (value) {
		this[sym.extd] = String(value);
	}

	get extraDesc () {return this[sym.extd]}

	set arguments (value) {
		this[sym.args].push(String(value));
	}

	get arguments () {return this[sym.args]}

	set permissions (value) {
		this[sym.perm] = new Permissions(value);
	}

	set guildOnly (value) {
		this[sym.gcmd] = Boolean(value);
	}

	get guildOnly () {return this[sym.gcmd]}

	set limit ([type, ...ids]) {
		if (this[sym.lcmd].has(type)) this[sym.lcmd].set(type, ids);
	}

	get hasExec () {
		if (this[sym.exec]) return true;
		return false;
	}

	exec (func) {
		if (typeof func !== 'function') {
			log.warn('Function not set for', this[sym.name]);
		} else {
			this[sym.exec] = func;
		}
	}
}

function getConfig (guildid) {
	let res

	if (!guildid) return new config(undefined);
	else if (typeof guildid === 'object' && guildid instanceof Guild) {
		guildid = guildid.id;
	} else {
		guildid = String(guildid);
	}

	res = saved.get(guildid);
	if (!res) {
		log.debug('Creating new config instance for', guildid);
		saved.set(guildid, res = new config(guildid));
	}

	return res;
}

module.exports = class moduleHandler extends moduleObj {
	constructor (file, func, bot) {
		super(bot);
		let ev = new emitter(), forwardEvent = async (event, first, ...params) => {
			let guild, comEnv;

			if (first instanceof Guild) guild = first;
			else if ('guild' in first) guild = first.guild;
			else if (first.message) guild = first.message.guild;
			else if (first instanceof Collection) {
				let temp = first.first();

				if ('guild' in temp) guild = temp.guild;
			}

			if (guild) {
				log.debug('Event belongs to guild', guild.name, 'getting module object for that guild');
				comEnv = this[sym.imap].get(guild.id);
			}
			if (!comEnv) {
				log.debug('Creating new command handler object for guild', guild.name);
				comEnv = new moduleObj(this[sym.ivar], this.bot);
				await this[sym.func].call(comEnv);
				comEnv.config = getConfig(guild);
				if (guild)
					this[sym.imap].set(guild.id, comEnv);
			}
			return comEnv.bot.emit(event, first, ...params);
		}
		Object.defineProperties(this, {
			[sym.file]: {value: file},
			[sym.func]: {value: func},
			[sym.imap]: {value: new Map()},
			[sym.ivar]: {value: bot},
			emit: {value: ev.emit.bind(ev)},
			bot: {
				value: new Proxy(bot, {
					get (target, prop, prox) {
						if (prop in ev) target = ev;
						return Reflect.get(target, prop);
					}
				}),
			}
		});
		ev.on('newListener', event => {
			if (ev.listenerCount(event) == 0) {
				bot.on(event, async (...params) => {
					try {
						await forwardEvent(event, ...params);
					} catch (e) {
						log.error(time(), 'Error occured forwarding event to command', this.command);
						log.error(e);
					}
				});
			}
		});
	}

	get file () {
		return this[sym.file];
	}

	access (user, guild) {
		let users = this[sym.lcmd].get('users'), guilds = this[sym.lcmd].get('guilds');

		if (guild) {
			let config = getConfig(guild), gUser = guild.members.cache.get(user.id);
			if (gUser && !gUser.permissions.has(config.permissions(this.command) || this[sym.perm])) return false;
			if (guilds.length && guilds.indexOf(guild.id) < 0) return false;
			if (config.disabled.has(this.command)) return false;
		} else {
			if (guilds.length) return false;
		}
		if (users.length && users.indexOf(user.id) < 0) return false;
		return true;
	}

	async run (msg, cmd, ...params) {
		let comEnv;

		try {
			checkPass.call(this, msg);
			log.debug(time(), msg.author.username, 'running command', this.command);
		} catch (e) {
			log.debug(time(), msg.author.username, 'Can\'t run command', this.command, 'because:', e.message);
			if (!e instanceof reqError)
				log.error('Error checking requirements:', e);
			return;
		}
		if (msg.guild)
			comEnv = this[sym.imap].get(msg.guild.id);

		if (!comEnv) {
			comEnv = new moduleObj(this[sym.ivar], this.bot);
			await this[sym.func].call(comEnv);
			comEnv.config = getConfig(msg.guild);
			if (msg.guild)
				this[sym.imap].set(msg.guild.id, comEnv);
		}
		return await comEnv[sym.exec](msg, ...params);

		function checkPass (msg) {
			let tmp = getConfig(msg.guild), users = this[sym.lcmd].get('users');

			if (!cmd.startsWith(tmp.prefix))
				throw new reqError('wrong prefix');
			if (msg.author.bot)
				throw new reqError('commands from bots not allowed');
			if (users.length > 0 && users.indexOf(msg.author.id) < 0)
				throw new reqError('command can only be used by specific users');

			if (msg.member) {
				let user = msg.member, guilds = this[sym.lcmd].get('guilds');

				if (guilds.length && guilds.indexOf(msg.guild.id) < 0)
					throw new reqError('command can only be used on specific guilds');
				if (tmp.disabled.has(this.command))
					throw new reqError('command is disabled on this server');
				if (!user.permissionsIn(msg.channel).has(tmp.permissions(this.command) || this[sym.perm]))
					throw new reqError('missing permissions for user');
			}
		}
	}
}
