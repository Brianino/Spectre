this.description = 'Kick a user';
this.arguments = '<@user> [reason]';
this.arguments = '<user id> [reason]';
this.permissions = 'KICK_MEMBERS';

function inGuild () {
	const { DiscordAPIError } = discordjs,
		{ getUserID } = Utils;

	function compareUserRoles (u1, u2) {
		const getHighest = (user) => user.roles.highest;

		return getHighest(u1).comparePositionTo(getHighest(u2));
	}

	return async (msg, input, message) => {
		const user = await getUserID(input, msg.guild, { resolve: true }),
			send = (content) => msg.channel.send({ content: content }),
			owner = await msg.guild.fetchOwner();

		if (!user)
			return send('Unable to find user');

		if (!user.manageable)
			return send('I lack the permissions to do so');

		if (user.id === msg.author.id)
			return send('You can\'t kick yourself');

		if (msg.author.id !== owner.id && compareUserRoles(msg.member, user) <= 0)
			return send('Target user has a higher role');

		try {
			await user.kick({ reason: String(message || 'No reason given') });
			log.warn(`${msg.author.username} (${msg.author.id}) kicked ${user.user.username} (${user.id})`);
			return send(`User ${user.user.username} was kicked`);
		} catch (e) {
			log.warn(`${msg.author.username} (${msg.author.id}) tried to kick ${user.user.username} (${user.id}) - Failed because ${e.toString()}`);
			if (e instanceof DiscordAPIError)
				return send(`Unable to kick user: ${e.message}`);

			log.error(e);
			return send('Internal error occured');
		}
	};
}
