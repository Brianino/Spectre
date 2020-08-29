const log = require('../etc/logger.js')('ban-module');
const {time, getUserID} = require('../etc/utilities.js');
const {DiscordAPIError} = require('discord.js');

setupModule(function () {
	this.command = 'ban';
	this.description = 'Ban a user';
	this.arguments = '<@user> [reason]';
	this.arguments = '<user id> [reason]';
	this.permissions = 'BAN_MEMBERS'
	this.guildOnly = true;

	this.exec((msg, input, message) => {
		let user = msg.guild.member(getUserID(input.join(' '), msg.guild));

		if (user && user.manageable) {
			let r1 = msg.member.roles.highest, r2 = user.roles.highest, otemp = msg.guild.owner.id;

			if (user.id === msg.author.id)
				return msg.channel.send('You can\'t ban yourself');
			else if (msg.author.id !== otemp && r1.comparePositionTo(r2) <=0)
				return msg.channel.send('Target user has a higher role');
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
		} else if (user && !user.manageable) {
			msg.channel.send('I lack the permissions to do so');
		} else {
			log.debug(time(), 'Search for:', mention[1], 'or', input);
			msg.channel.send('Unable to find user');
		}
	});
});
