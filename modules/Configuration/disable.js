this.description = 'disables a command on a server (meaning no one can use it)';
this.arguments = '[...command]';
this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];

function inGuild () {
	return (msg, ...commands) => {
		let disabled = this.config.disabled, res = [];

		for (let command of commands) {
			if (modules.has(command) && command !== 'enable')
				if (!disabled.has(command)) res.push(command);
		}
		if (res.length > 0) {
			this.config.disabled = res;
			return msg.channel.send('Disabled commands: `' + res.join('` `') + '`');
		} else {
			return msg.channel.send('No new commmands to disable');
		}
	}
}
