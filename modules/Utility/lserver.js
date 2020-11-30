const {owner} = require('../../config.json');

this.description = 'leaves a specified server';
this.extraDesc = 'use the list servers command to get the server id';
this.arguments = '<serverid>';
this.limit = ['users', owner];

function inAll () {
	return async (msg, id) => {
		try {
			await this.bot.guilds.resolve(id).leave();
			return msg.channel.send('Left server');
		} catch (e) {
			log.error(time(), 'unable to leave server:', e.toString());
			return msg.channel.send('Unable to leave server, check logs');
		}
	}
}
