const {owner} = require('../config.json');

this.description = 'lists all the servers the bot is in';
this.limit = ['users', owner];

this.arguments = '';

function inAll () {
	return msg => {
		let guilds = getBot().guilds.cache, embed = {
			title: 'Guilds',
			color: 0xBB0000,
			fields: []
		}

		for (let guild of guilds.values()) {
			let clientGuildAcc = guild.members.resolve(getBot().user.id);
			embed.fields.push({
				name: `${guild.name} - ${clientGuildAcc.joinedAt.toDateString()}`,
				value: guild.id
			});
		}

		return msg.channel.send({embed});
	}
}
