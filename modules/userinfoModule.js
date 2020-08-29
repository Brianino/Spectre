const log = require('../etc/logger.js')('userinfo-module');
const {time, getUserID} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'userinfo';
	this.description = 'Displays info on a user';
	this.guildOnly = true;

	this.exec(async (msg, ...input) => {
		let user = msg.guild.member(getUserID(input.join(' '), msg.guild, {allowText: 'partial'})) || msg.member, embed;

		embed = {
			title: user.displayName,
			description: user.user.tag || 'Can\'t get user tag',
			color: user.displayColor,
			thumbnail: {
				url: user.user.displayAvatarURL({
					format: 'png',
					dynamic: true,
				}),
			},
			fields: [{
				name: 'Created',
				value: [
					user.user.createdAt.toDateString(),
					'at ' + user.user.createdAt.toTimeString(),
				].join('\n'),
			}, {
				name: 'Joined',
				value: [
					user.joinedAt.toDateString(),
					'at ' + user.joinedAt.toTimeString(),
				].join('\n'),
			}, {
				name: 'Roles',
				value: '`' + user.roles.cache.map(role => role.name).join('` `') + '`',
			}, {
				name: 'Permissions',
				value: '`' + user.permissions.toArray(false).join('` `') + '`',
			}],
			footer: {
				text: user.presence.status + ' - ' + user.id,
				icon_url: user.user.displayAvatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}

		if (user.premiumSince) {
			embed.fields.push({
				name: 'Server Boost',
				value: [
					user.premiumSince.toDateString(),
					'at ' + user.premiumSince.toTimeString(),
				].join('\n'),
			});
		}
		return msg.channel.send({embed});
	});
});
