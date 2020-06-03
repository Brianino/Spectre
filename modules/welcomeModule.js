const log = require('debug-logger')('welcome-module');
const {time} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'welcome';
	this.description = 'set the server welcome message';
	this.extraDesc = 'user mention: {user}\nserver name: {server}'
	this.arguments = '<message>';
	this.permissions = 'MANAGE_GUILD';
	this.guildOnly = true;

	this.addConfig('welcome_message', String, 'Welcome {user} to {server}', 'welcome message for users');
	this.addConfig('welcome_bot_message', String, undefined, 'message to display when bots join');
	this.addConfig('welcome_channel', String, undefined, 'where to display welcome message\n if it fails to display a message the value is changed back to undefined');

	this.bot.on('guildMemberAdd', member => {
		let guild = member.guild;

		log.info('member joined:', guild.name, member.user.username);
		if (this.config.welcome_channel) {
			let msg = '';
			if (!member.user.bot) msg = this.config.welcome_message;
			else msg = this.config.welcome_bot_message;

			if (msg) {
				let channel, tmp;
				msg = msg.replace(/\{server\}/g, guild.name);
				msg = msg.replace(/\{user\}/g, '<@' + member.id + '>');

				if (tmp = /(?<=^\<#)\d{17,19}(?=\>$)/.exec(this.config.welcome_channel)) {
					channel = guild.channels.resolve(tmp[0])
				} else if (/^\d{17,19}$/.exec(this.config.welcome_channel)) {
					channel = guild.channels.resolve(this.config.welcome_channel);
				} else {
					channel = guild.channels.cache.find(channel => channel.name.includes(this.config.welcome_channel));
				}

				if (channel && channel.type === 'text') {
					return channel.send(msg);
				} else {
					log.error(time(), 'Unable to find welcome text channel');
					this.config.welcome_channel = undefined;
				}
			} else return;
		}
	});

	this.exec((msg, ...input) => {
		let message = input.join(' ');

		log.info(time(), 'Updating welcome message for', msg.guild.name, 'to:', message);
		if (message === '') this.config.welcome_message = undefined;
		else this.config.welcome_message = message;

		return msg.channel.send('Welcome message updated');
	});
});
