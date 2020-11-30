this.command = 'ping';
this.description = 'ping discord';

function inAll () {
	return msg => {
		return msg.channel.send('Pong ' + this.bot.ws.ping + 'ms');
	}
}
