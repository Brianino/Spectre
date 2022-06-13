/* eslint no-undef: "warn" */
/* global access, addConfig, discordjs, getBot, getConfigurable, inspect, log, modules, OwnerID, timespan, Utils, _ */

this.description = 'enables a disabled command on a server';
this.arguments = '[...command]';
this.permissions = ['MANAGE_GUILD', 'MANAGE_CHANNELS'];

function inGuild () {
	return (msg, ...commands) => {
		const disabled = this.config.disabled, res = [];

		for (const command of commands) {
			if (disabled.has(command)) {
				disabled.delete(command);
				res.push(command);
			}
		}
		if (res.length > 0) {
			this.config.disabled = disabled;
			return msg.channel.send({ content: `Enabled commands: \`${res.join('` `')}\`` });
		} else {
			return msg.channel.send({ content: `Can enable: ${[...disabled].toString()}` });
		}
	};
}
