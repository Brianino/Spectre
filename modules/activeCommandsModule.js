const log = require('debug-logger')('active-commands-module');
const {modules} = require('../etc/moduleLoader.js');
const {guildConfig} = require('../etc/guildConfig.js');
const {DiscordAPIError} = require('discord.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'enable';
	this.description = 'enables a disabled command on a server';
	this.arguments = '[...command]';
	this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];
	this.guildOnly = true;

	this.exec((msg, ...commands) => {
		let config = guildConfig(msg.guild.id), disabled = config.disabled;

		config.disabled = disabled.filter(val => !commands.includes(val));
		commands = commands.filter(val => disabled.includes(val));
		if (commands.length > 0) {
			return msg.channel.send('Enabled commands: `' + commands.join('` `') + '`');
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
		let config = guildConfig(msg.guild.id), old = config.disabled;

		commands = commands.filter(val => modules.has(val) && !old.includes(val) && val !== 'enable' && val !== 'disable');
		config.disabled = old.concat(commands);
		if (commands.length > 0) {
			return msg.channel.send('Disabled commands: `' + commands.join('` `') + '`');
		} else {
			return msg.channel.send('No new commmands to disable');
		}
	});
});
