const log = require('debug-logger')('welcome-module');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'welcome';
	this.description = 'set the server welcome message';
	this.extraDesc = 'user mention: {user}\nserver name: {server}'
	this.arguments = '<message>';
	this.permissions = 'MANAGE_GUILD';
	this.guildOnly = false;

	this.configVar('welcome_message', String, 'Welcome {user} to {server}', 'welcome message for users');
	this.configVar('welcome_bot_message', String, undefined, 'message to display when bots join');
	this.configVar('welcome_channel', String, undefined, 'where to display welcome message\n if it fails to display a message the value is changed back to undefined');

	this.bot.on('guildMemberAdd', member => {
		let guild = member.guild, config = this.config(guild.id);
		log.info('member joined:', guild.name, member.user.username);
		if (config.welcome_channel) {
			let msg = '';
			if (!member.user.bot) msg = config.welcome_message;
			else msg = config.welcome_bot_message;

			if (msg) {
				let channel, tmp;
				msg = msg.replace(/\{server\}/g, guild.name);
				msg = msg.replace(/\{user\}/g, '<@' + member.id + '>');

				if (tmp = /(?<=^\<#)\d{17,19}(?=\>$)/.exec(config.welcome_channel)) {
					channel = guild.channels.resolve(tmp[0])
				} else if (/^\d{17,19}$/.exec(config.welcome_channel)) {
					channel = guild.channels.resolve(config.welcome_channel);
				} else {
					channel = guild.channels.cache.find(channel => channel.name.includes(config.welcome_channel));
				}

				if (channel && channel.type === 'text') {
					return channel.send(msg);
				} else {
					log.error(time(), 'Unable to find welcome text channel');
					config.welcome_channel = undefined;
				}
			} else return;
		}
	});

	this.exec((msg, ...input) => {
		let message = input.join(' '), conf = this.config(msg.guild.id);

		log.info(time(), 'Updating welcome message for', msg.guild.name, 'to:', message);
		if (message === '') conf.welcome_message = undefined;
		else conf.welcome_message = message;

		return msg.channel.send('Welcome message updated');
	});
});
