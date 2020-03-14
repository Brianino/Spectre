const log = require('debug-logger')('perm-module');
const {modules} = require('../etc/moduleLoader.js');
const {RichEmbed} = require('discord.js');
const persistant = require('../data/permissions.json');
const time = require('../etc/time.js');
const fs = require('fs').promises;

setupModule('permissions', function () {
	this.command = 'permissions';
	this.description = 'Modifying required permissions for commands';
	this.permissions = 'ADMINISTRATOR'
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

	//post module load event;

	function setPermission (guild, command, ...perms) {
		let cmd = modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '') command = ' ';
		if (cmd) {
			perms.forEach((val, index) => {
				val = Number(val);
				if (!isNaN(val)) perms[index] = val;
			});
			try {
				cmd.permissions(guild, ...perms);

				persistant[guild.id] = perms;
				fs.writeFile('./data/permissions.json', JSON.stringify(persistant), {flag: 'w'}).catch(e => {
					log.error(time(), 'Unable save to command permissions to file:', e.toString());
				});
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
			return this.send([`Permissions for: ${command}`, ...cmd.permissions(guild).toArray().map(val => '`' + val + '`')]);
		} else {
			return this.send(`Could not find command \`${command}\``);
		}
	}

	function listPermission (guild) {
		for (let cmd of modules.values()) {
			return this.send([`Permissions for: ${cmd.command}`, ...cmd.permissions(guild).toArray().map(val => '`' + val + '`')]);
		}
	}
});
