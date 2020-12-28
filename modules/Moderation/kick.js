const {getUserID} = require('../utils/getDiscordObject.js');
const {DiscordAPIError} = require('discord.js');

this.description = 'Kick a user';
this.arguments = '<@user> [reason]';
this.arguments = '<user id> [reason]';
this.permissions = 'KICK_MEMBERS'

function inGuild () {
	return async (msg, input, message) => {
		let user = msg.guild.member(await getUserID(input, msg.guild, {resolve: true}));

		if (user && user.manageable) {
			let r1 = msg.member.roles.highest, r2 = user.roles.highest, otemp = msg.guild.owner.id;

			if (user.id === msg.author.id)
				return msg.channel.send('You can\'t kick yourself');
			else if (msg.author.id !== otemp && r1.comparePositionTo(r2) <=0)
				return msg.channel.send('Target user has a higher role');

			try {
				await user.kick(String(message || 'No reason given'));
				log.warn(time(), msg.author.username, 'kicked', user.user.username);
				log.file.moderation('WARN', msg.author.username, 'kicked', user.user.username, 'ids:', msg.author.id, user.id);
				return msg.channel.send('User `' + user.user.username + '` was kicked');
			} catch (e) {
				log.warn(time(), msg.author.username, 'tried to kick', user.user.username);
				if (e instanceof DiscordAPIError)
					return msg.channel.send('Unable to kick user: ' + e.message);
				else {
					log.error(time(), e);
					return msg.channel.send('Internal error, check server logs');
				}
			}
		} else if (user && !user.manageable) {
			msg.channel.send('I lack the permissions to do so');
		} else {
			log.debug(time(), 'Search for:', user?.toString(), 'or', input);
			msg.channel.send('Unable to find user');
		}
	}
}
