this.description = 'leaves a specified server';
this.extraDesc = 'use the list servers command to get the server id';
this.arguments = '<serverid>';
this.limit('users', OwnerID);

function inAll () {
	return async (msg, id) => {
		try {
			await getBot().guilds.resolve(id).leave();
			return msg.channel.send({ content: 'Left server' });
		} catch (e) {
			log.error('unable to leave server:', e.toString());
			return msg.channel.send({ content: 'Unable to leave server, check logs' });
		}
	};
}
