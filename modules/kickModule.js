const log = require('debug-logger')('kick-module');
const {modules} = require('../etc/moduleLoader.js');
const {DiscordAPIError} = require('discord.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'kick';
	this.description = 'Kick a user';
	this.permissions = 'KICK_MEMBERS'
	this.guildOnly = true;

	this.exec((msg, input, message) => {
		let mention = /(?<=\<@!?)\d{17,19}(?=\>)/.exec(input = String(input)) || [];
		let user = msg.guild.member(mention[0] || input);

		if (user) {
			return user.kick(String(message || 'No reason given')).then(() => {
				log.warn(time(), msg.author.username, 'kicked', user.user.username);
				return msg.channel.send('User `' + user.user.username + '` was kicked');
			}).catch(e => {
				log.warn(time(), msg.author.username, 'tried to kick', user.user.username);
				if (e instanceof DiscordAPIError)
					return msg.channel.send('Unable to kick user: ' + e.message);
				else {
					log.error(time(), e);
					return msg.channel.send('Internal error, check server logs');
				}
			});
		} else {
			log.debug(time(), 'Search for:', mention[0], 'or', input);
			msg.channel.send('Unable to find user');
		}
	});
});
