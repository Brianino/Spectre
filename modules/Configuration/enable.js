this.description = 'enables a disabled command on a server';
this.arguments = '[...command]';
this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];

function inGuild () {
	return (msg, ...commands) => {
		let disabled = this.config.disabled, res = [];

		for (let command of commands) {
			if (disabled.has(command)) {
				disabled.delete(command);
				res.push(command);
			}
		}
		if (res.length > 0) {
			this.config.disabled = disabled;
			return msg.channel.send('Enabled commands: `' + res.join('` `') + '`');
		} else {
			return msg.channel.send('No new commmands to enable');
		}
	}
}
