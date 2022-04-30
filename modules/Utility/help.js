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

	function textSort (a, b) {
		a = String(a).toUpperCase();
		b = String(b).toUpperCase();
		if (a < b)
			return -1;
		if (a > b)
			return 1;
		return 0;
	}

	function handleModules (config, msg) {
		const main = [], other = [];
		for (const mod of modules.values()) {
			if (access.call(mod, msg.author, msg.guild, config)) {
				const tmp = (mod.group === 'Other') ? other : main;
				tmp.push([ mod.group, mod.command, mod.description[0]]);
			}
		}
		main.sort(([ g1, c1 ], [ g2, c2 ]) => textSort(g1, g2) || textSort(c1, c2));
		return main.concat(other);
	}

	function makePagedHelp (config, msg) {
		const data = handleModules(config, msg), helpEmbed = new PagedEmbed('Options');
		let lastGroup, pageNo = 0;

		for (const [group, ...details] of data) {
			if (group !== lastGroup) {
				const desc = detailedHelp[group] ?? `${group} commands`;
				lastGroup = group;
				pageNo = helpEmbed.addPage(group, [details], desc);
			} else {
				helpEmbed.addToPage(pageNo, details);
			}
		}
		return helpEmbed;
	}

	function makeSinglePageHelp (config, cmd) {
		const helpEmbed = new PagedEmbed(), tmp = config.prefix.concat(cmd.command);

		helpEmbed.addPage(cmd.command, [], cmd.description.join('\n'));
		if (cmd.arguments.length)
			helpEmbed.addToPage(0, ['Command Usage:', cmd.arguments.map(val => `${tmp} ${val}`).join('\n')]);
		if (cmd.vars.length)
			helpEmbed.addToPage(0, ['Configurable Settings:', `\`${cmd.vars.join('` `')}\``]);
		return helpEmbed;
	}

	return function main (msg, arg) {
		if (!arg) {
			const helpEmbed = makePagedHelp(this, msg);
			log.debug('Posting help (no args)');
			return helpEmbed.sendTo(msg.channel);
		} else {
			const cmd = modules.get(arg = String(arg));

			if (cmd && access.call(cmd, msg.author, msg.guild, this)) {
				const helpEmbed = makeSinglePageHelp(this, cmd);
				log.debug('Posting help (args)');
				return helpEmbed.sendTo(msg.channel);
			} else {
				arg = arg.replace(/`/g, '');
				if (arg === '')
					arg = ' ';
				return msg.channel.send({ content: `Could not find command \`${arg}\`` });
			}
		}
	};
}
