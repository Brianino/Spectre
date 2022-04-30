this.command = 'serverinfo';
this.description = 'Displays info on the server';

this.arguments = '';

function inGuild () {
	return msg => {
		const server = msg.guild, channels = server.channels.cache, users = server.members.cache, roles = server.roles.cache,
			text = channels.filter(tmp => tmp.type === 'GUILD_TEXT'),
			voice = channels.filter(tmp => tmp.type === 'GUILD_VOICE'),
			category = channels.filter(tmp => tmp.type === 'GUILD_CATEGORY'),
			other = channels.filter(tmp => ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY'].indexOf(tmp.type) < -1),
			online = users.filter(tmp => tmp.presence.status === 'online'),
			idle = users.filter(tmp => ['idle', 'dnd'].indexOf(tmp.presence.status) >= 0),
			ping = roles.filter(tmp => tmp.mentionable);

		log.debug('Icon?', server.icon);
		return msg.channel.send({
			embeds: [{
				title: server.name,
				description: [
					server.description,
					`ID: ${server.id}`,
				].join('\n'),
				color: 0xBB0000,
				thumbnail: {
					url: server.iconURL({
						format: 'png',
						dynamic: true,
					}),
				},
				fields: [{
					name: `Server: ${server.region}`,
					value: [
						`Created: ${server.createdAt.toDateString()}`,
						`at ${server.createdAt.toTimeString()}`,
					].join('\n'),
				}, {
					name: `Channels: ${channels.size}`,
					value: [
						`Category: ${category.size}`,
						`Text: ${text.size}`,
						`Voice: ${voice.size}`,
						`Other: ${other.size}`,
					].join('\n'),
					inline: true,
				}, {
					name: `Members: ${server.memberCount}`,
					value: [
						`Online: ${online.size}`,
						`Idle/DND: ${idle.size}`,
					],
					inline: true,
				}, {
					name: 'Nitro Boosting',
					value: [
						`Boost level: ${server.premiumTier}`,
						`Boosters: ${server.premiumSubscriptionCount}`,
					].join('\n'),
					inline: true,
				}, {
					name: `Roles: ${roles.size}`,
					value: `Pingable: ${ping.size}`,
				}],
				footer: {
					text: `Owner: ${server.owner.user.tag}`,
					icon_url: server.owner.user.displayAvatarURL({
						format: 'png',
						dynamic: true,
					}),
				},
			}],
		});
	};
}
