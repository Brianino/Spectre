const log = require('debug-logger')('perm-module');
const {modules} = require('../etc/moduleLoader.js');
const time = require('../etc/time.js');
const fs = require('fs').promises;

setupModule(function () {
	this.command = 'permissions';
	this.description = 'Modifying required permissions for commands';
	this.arguments = 'set <command> [...permission]';
	this.arguments = 'show <command>';
	this.arguments = 'list';
	this.permissions = 'ADMINISTRATOR';
	this.guildOnly = true;


	this.exec((msg, ...args) => {
		switch (args.shift()) {
			case 'list': // display permissions for all commands
			return listPermission.call(this, msg);
			break;
			case 'show': // display permissions for a command
			return showPermission.call(this, msg, args.shift());
			break;
			case 'set': //set the permissions for a command
			return setPermission.call(this, msg, args.shift(), args);
			break;
			default:
			return msg.channel.send('Unknown option, use either:\n' +
				'`list` (to list the permissions for all the commands)\n' +
				'`show` (to show the permissions for a single command)\n' +
				'`set` (to set the permissions for a command)');
		}
	});

	function setPermission (msg, command, perms) {
		let cmd = modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '') command = ' ';
		if (cmd && cmd.access(msg.author, msg.guild)) {
			perms.forEach((val, index) => {
				let tmp = Number(val);
				if (!isNaN(tmp)) perms[index] = tmp;
				else perms[index] = String(val).toUpperCase();
			});
			try {
				let config = this.config(msg.guild.id);

				config.permissions = [command, ...perms];
				return msg.channel.send(`Permissions for \`${command}\` updated`);
			} catch (e) {
				log.error(time(), 'Failed to set permissions:', e.toString());
				log.error(e.stack);
				return msg.channel.send('There was an error updating permissions, check server logs for more info');
			}
		} else {
			return msg.channel.send(`Could not find command \`${command}\``);
		}
	}

	function showPermission (msg, command) {
		let cmd =  modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '') command = ' ';
		if (cmd && cmd.access(msg.author, msg.guild)) {
			msg.channel.send({
				embed: {
					title: 'Permissions',
					fields: {
						name: command,
						value: '`' + cmd.permissions(msg.guild.id).toArray(false).join('` `') + '`',
						inline: false,
					},
					color: 0xBB0000
				}
			});
		} else {
			return msg.channel.send(`Could not find command \`${command}\``);
		}
	}

	function listPermission (msg) {
		let embed = {
				title: 'Permissions',
				color: 0xBB0000,
				fields: [],
			};
		for (let cmd of modules.values()) {
			if (cmd.access(msg.author, msg.guild)) {
				embed.fields.push({
					name: cmd.command,
					value: '`' + cmd.permissions(msg.guild.id).toArray(false).join('`\n`') + '`',
					inline: true,
				});
			}
		}
		return msg.channel.send({embed});
	}
});
