const log = require('debug-logger')('perm-module');
const {guildLoad, addGuild} = require('../etc/guildConfig.js');
const {modules} = require('../etc/moduleLoader.js');
const time = require('../etc/time.js');
const fs = require('fs').promises;

setupModule(function () {
	var guildConfig = new Map();
	this.command = 'permissions';
	this.description = 'Modifying required permissions for commands';
	this.permissions = 'ADMINISTRATOR';
	this.guildOnly = true;


	this.exec((msg, ...args) => {
		switch (args.shift()) {
			case 'list': // display permissions for all commands
			return listPermission.call(msg.channel, msg.guild);
			break;
			case 'show': // display permissions for a command
			return showPermission.call(msg.channel, msg.guild, args.shift());
			break;
			case 'set': //set the permissions for a command
			return setPermission.call(msg.channel, msg.guild, args.shift(), args);
			break;
			default:
			return msg.channel.send('Unknown option, use either `list` `show` or `set`');
		}
	});

	this.modules.on('ready', async () => {
		guildConfig = await guildLoad;
		for (let [id, config] of guildConfig) {
			let guild = this.bot.guilds.resolve(id);

			for (let [command, perms] of config.perms) {
				let cmd = modules.get(command);

				if (cmd) cmd.permissions(guild, ...perms);
				else config.perms = [command];
			}
			log.info(time(), 'Loaded custom command permissions for server', guild.name);
		}
	});

	//post module load event;

	function setPermission (guild, command, perms) {
		let cmd = modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '') command = ' ';
		if (cmd) {
			perms.forEach((val, index) => {
				let tmp = Number(val);
				if (!isNaN(tmp)) perms[index] = tmp;
				else perms[index] = String(val).toUpperCase();
			});
			try {
				let config = guildConfig.get(guild.id)
				cmd.permissions(guild, ...perms);

				if (config) config.perms = [command, ...perms];
				else addGuild(guild.id, {perms: [[command, perms]]});
				return this.send(`Permissions for \`${command}\` updated`);
			} catch (e) {
				log.error(time(), 'Failed to set permissions:', e.toString());
				log.error(e.stack);
				return this.send('There was an error updating permissions, check server logs for more info');
			}
		} else {
			return this.send(`Could not find command \`${command}\``);
		}
	}

	function showPermission (guild, command) {
		let cmd =  modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '') command = ' ';
		if (cmd) {
			this.send({
				embed: {
					title: 'Permissions',
					fields: {
						name: command,
						value: '`' + cmd.permissions(guild).toArray().join('` `') + '`',
						inline: false,
					},
					color: 0xBB0000
				}
			});
		} else {
			return this.send(`Could not find command \`${command}\``);
		}
	}

	function listPermission (guild) {
		let embed = {
				title: 'Permissions',
				color: 0xBB0000,
				fields: [],
			};
		for (let cmd of modules.values()) {
			embed.fields.push({
				name: cmd.command,
				value: '`' + cmd.permissions(guild).toArray().join('`\n`') + '`',
				inline: true,
			});
		}
		return this.send({embed});
	}
});
