const log = require('debug-logger')('ban-module');
const {modules} = require('../etc/moduleLoader.js');
const {DiscordAPIError} = require('discord.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'ban';
	this.description = 'Ban a user';
	this.permissions = 'BAN_MEMBERS'
	this.guildOnly = true;

	this.exec((msg, input, message) => {
		let mention = /(?<=\<@!?)\d{17,19}(?=\>)/.exec(input = String(input)) || [];
		let user = msg.guild.member(mention[1] || input);

		if (user) {
			return user.ban({
				reason: String(message || 'No reason given'),
			}).then(() => {
				log.warn(time(), msg.author.username, 'banned', user.user.username);
				return msg.channel.send('User `' + user.user.username + '` was banned');
			}).catch(e => {
				log.warn(time(), msg.author.username, 'tried to ban', user.user.username);
				if (e instanceof DiscordAPIError)
					return msg.channel.send('Unable to ban user: ' + e.message);
				else {
					log.error(time(), e);
					return msg.channel.send('Internal error, check server logs');
				}
			});
		} else {
			log.debug(time(), 'Search for:', mention[1], 'or', input);
			msg.channel.send('Unable to find user');
		}
	});
});
