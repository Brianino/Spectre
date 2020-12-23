this.command = 'ping';
this.description = 'ping discord';

this.arguments = '';

function inAll () {
	return msg => {
		return msg.channel.send('Pong ' + getBot().ws.ping + 'ms');
	}
}
