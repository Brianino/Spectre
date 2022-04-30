this.command = 'userinfo';
this.description = 'Displays info on a user';
this.description = 'A user user can be picked with thier id, by mention, or by name';

this.arguments = '[user]';

function inGuild () {
	const { getUserID } = Utils;

	return async (msg, ...input) => {
		const user = await getUserID(input.join(' '), msg.guild, { allowText: 'partial', resolve: true }) || msg.member,
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
						`at ${user.user.createdAt.toTimeString()}`,
					].join('\n'),
				}, {
					name: 'Joined',
					value: [
						user.joinedAt.toDateString(),
						`at ${user.joinedAt.toTimeString()}`,
					].join('\n'),
				}, {
					name: 'Roles',
					value: `\`${user.roles.cache.map(role => role.name).join('` `')}\``,
				}, {
					name: 'Permissions',
					value: `\`${user.permissions.toArray(false).join('` `')}\``,
				}],
				footer: {
					text: `${user.presence.status} - ${user.id}`,
					icon_url: user.user.displayAvatarURL({
						format: 'png',
						dynamic: true,
					}),
				},
			};

		if (user.premiumSince) {
			embed.fields.push({
				name: 'Server Boost',
				value: [
					user.premiumSince.toDateString(),
					`at ${user.premiumSince.toTimeString()}`,
				].join('\n'),
			});
		}
		return msg.channel.send({ embeds: [embed] });
	};
}
