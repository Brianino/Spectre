this.description = 'lists all the servers the bot is in';
this.limit('users', OwnerID);

this.arguments = '';

function inAll () {
	return msg => {
		const guilds = getBot().guilds.cache, embed = {
			title: 'Guilds',
			color: 0xBB0000,
			fields: [],
		};

		for (const guild of guilds.values()) {
			const clientGuildAcc = guild.members.resolve(getBot().user.id);
			embed.fields.push({
				name: `${guild.name} - ${clientGuildAcc.joinedAt.toDateString()}`,
				value: guild.id,
			});
		}

		return msg.channel.send({ embed });
	};
}
