const log = require('debug-logger')('active-commands-module');
const {modules} = require('../etc/moduleLoader.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'enable';
	this.description = 'enables a disabled command on a server';
	this.arguments = '[...command]';
	this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];
	this.guildOnly = true;

	this.exec((msg, ...commands) => {
		let disabled = this.config(msg.guild.id).disabled, res = [];

		for (let command of commands) {
			if (disabled.has(command)) {
				disabled.delete(command);
				res.push(command);
			}
		}
		if (res.length > 0) {
			this.config(msg.guild.id).disabled = disabled;
			return msg.channel.send('Enabled commands: `' + res.join('` `') + '`');
		} else {
			return msg.channel.send('No new commmands to enable');
		}
	});
});

setupModule(function () {
	this.command = 'disable';
	this.description = 'disables a command on a server (meaning no one can use it)';
	this.arguments = '[...command]';
	this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];
	this.guildOnly = true;

	this.exec((msg, ...commands) => {
		let disabled = this.config(msg.guild.id).disabled, res = [];

		for (let command of commands) {
			if (modules.has(command)) {
				if (!disabled.has(command)) res.push(command);
			}
		}
		if (res.length > 0) {
			this.config(msg.guild.id).disabled = res;
			return msg.channel.send('Disabled commands: `' + res.join('` `') + '`');
		} else {
			return msg.channel.send('No new commmands to disable');
		}
	});
});
