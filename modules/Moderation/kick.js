this.description = 'Kick a user';
this.arguments = '<@user> [reason]';
this.arguments = '<user id> [reason]';
this.permissions = 'KICK_MEMBERS'

function inGuild () {
	const { DiscordAPIError } = discordjs;
	const { getUserID } = Utils;

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
				log.warn(`${msg.author.username} (${msg.author.id}) kicked ${user.user.username} (${user.id})`);
				return msg.channel.send(`User ${user.user.username} was kicked`);
			} catch (e) {
				log.warn(`${msg.author.username} (${msg.author.id}) tried to kick ${user.user.username} (${user.id}) - Failed because ${e.toString()}`);
				if (e instanceof DiscordAPIError)
					return msg.channel.send(`Unable to kick user: ${e.message}`);
				else {
					log.error(e);
					return msg.channel.send('Internal error occured');
				}
			}
		} else if (user && !user.manageable) {
			msg.channel.send('I lack the permissions to do so');
		} else {
			log.debug('Search for:', user?.toString(), 'or', input);
			msg.channel.send('Unable to find user');
		}
	}
}
