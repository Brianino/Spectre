this.description = 'Display command help';
this.description = 'Command arguments in the help will display a quick summary of the different format a command can take';
this.description = 'Arguments surrounded with `[]` are optional, meaning that you can choose to leave it out (do not include the brackets when typing out the command)';
this.description = 'Arguments surrounded with `<>` are required, meaning that you have to enter something for it (do not include the brackets when typing out the command)';
this.description = 'Arguments not surrounded with brackets are fixed, meaning that exactly that input needs to be provided';
this.description = 'Arguments with `...` infront of them means that one or more of it can be provided';

this.arguments = '[command]';
this.arguments = '';

const detailedHelp = {
	'Configuration': 'These commands are used to change how the bot will operate on this server',
	'Moderation': 'These commands are to assist with server moderation tasks',
	'Utility': 'Utility commands',
};

function inAll () {
	const { PagedEmbed } = Utils;

	return function main (msg, arg) {
		if (!arg) {
			const helpEmbed = new PagedEmbed('Options'), pages = new Map();

			helpEmbed.setColor(0xBB0000);
			for (const moduleObj of modules.values()) {
				const details = [moduleObj.command, moduleObj.description[0]];
				let page = pages.get(moduleObj.group);

				if (page === undefined) {
					const desc = detailedHelp[moduleObj.group] || (`${moduleObj.group} commands`);
					page = helpEmbed.addPage(moduleObj.group, [details], desc);
					pages.set(moduleObj.group, page);
				} else {
					helpEmbed.addToPage(page, [details]);
				}
			}
			log.debug('Posting help (no args)');
			return helpEmbed.sendTo(msg.channel);
		} else {
			const cmd = modules.get(arg = String(arg));

			arg = arg.replace(/`/g, '');
			if (arg === '')
				arg = ' ';
			if (cmd && access.call(cmd, msg.author, msg.guild, this)) {
				const comStr = `${this.prefix + cmd.command} `, embed = {
					title: arg,
					description: cmd.description.join('\n'),
					color: 0xBB0000,
					fields: [],
				};

				if (cmd.arguments.length) {
					embed.fields.push({
						name: 'Command Usage:',
						value: cmd.arguments.map(val => comStr + val).join('\n'),
					});
				}
				if (cmd.vars.length) {
					embed.fields.push({
						name: 'Configurable Settings:',
						value: `\`${cmd.vars.join('` `')}\``,
					});
				}
				log.debug('Posting help (args)');
				return msg.channel.send({ embed });
			} else {
				return msg.channel.send(`Could not find command \`${arg}\``);
			}
		}
	};
}
