const log = require('debug-logger')('serverinfo-module');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'serverinfo';
	this.description = 'Displays info on the server';
	this.guildOnly = true;

	this.exec((msg) => {
		let server = msg.guild, channels = server.channels.cache, users = server.members.cache, roles = server.roles.cache,
			text = channels.filter(tmp => tmp.type === 'text'),
			voice = channels.filter(tmp => tmp.type === 'voice'),
			category = channels.filter(tmp => tmp.type === 'category'),
		 	other = channels.filter(tmp => ['text', 'voice', 'category'].indexOf(tmp.type) < -1),
		 	online = users.filter(tmp => tmp.presence.status === 'online'),
		 	idle = users.filter(tmp => ['idle', 'dnd'].indexOf(tmp.presence.status) >= 0),
		 	ping = roles.filter(tmp => tmp.mentionable);

		log.debug(time(), 'Icon?', server.icon);
		return msg.channel.send({
			embed: {
				title: server.name,
				description: [
					server.description,
					'ID: ' + server.id,
					//'Shard: ' + server.shardID, //shard is currently not in use
				].join('\n'),
				color: 0xBB0000,
				thumbnail: {
					url: server.iconURL({
						format: 'png',
						dynamic: true,
					}),
				},
				fields: [{
					name: 'Server: ' + server.region,
					value: [
						'Created: ' + server.createdAt.toDateString(),
						'at ' + server.createdAt.toTimeString(),
					].join('\n'),
				}, {
					name: 'Channels: ' + channels.size,
					value: [
						'Category: ' + category.size,
						'Text: ' + text.size,
						'Voice: ' + voice.size,
						'Other: ' + other.size,
					].join('\n'),
					inline: true,
				}, {
					name: 'Members: ' + server.memberCount,
					value: [
						'Online: ' + online.size,
						'Idle/DND: ' + idle.size,
					],
					inline: true,
				}, {
					name: 'Nitro Boosting',
					value: [
						'Boost level: ' + server.premiumTier,
						'Boosters: ' + server.premiumSubscriptionCount
					].join('\n'),
					inline: true,
				}, {
					name: 'Roles: ' + roles.size,
					value: 'Pingable: ' + ping.size,
				}],
				footer: {
					text: 'Owner: ' + server.owner.user.tag,
					icon_url: server.owner.user.avatarURL({
						format: 'png',
						dynamic: true,
					}),
				}
			}
		});
	});
});
