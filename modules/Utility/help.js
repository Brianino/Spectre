this.description = 'Display command help';
this.description = 'Command arguments in the help will display a quick summary of the different format a command can take';
this.description = 'Arguments surrounded with `[]` are optional, meaning that you can choose to leave it out (do not include the brackets when typing out the command)';
this.description = 'Arguments surrounded with `<>` are required, meaning that you have to enter something for it (do not include the brackets when typing out the command)';
this.description = 'Arguments not surrounded with brackets are fixed, meaning that exactly that input needs to be provided';
this.description = 'Arguments with `...` infront of them means that one or more of it can be provided';

this.arguments = '[command]';
this.arguments = '';

function inAll () {
	/* TO DO:
	 * Implement paging based on categories
	*/
	return function (msg, arg) {
		if (!arg) {
			let embed = {
				title: 'Options',
				description: 'Available commands',
				color: 0xBB0000,
				fields: []
			};

			for (let [cmd, moduleObj] of modules) {
				if (access.call(moduleObj, msg.author, msg.guild, this)) {
					embed.fields.push({
						name: this.prefix + cmd,
						value: moduleObj.description[0],
						inline: false
					});
				}
			}
			log.debug(time(), 'Posting help (no args)');
			return msg.channel.send({embed});
		} else {
			let cmd = modules.get(arg = String(arg));

			arg = arg.replace(/`/g, '');
			if (arg === '') arg = ' ';
			if (cmd && access.call(cmd, msg.author, msg.guild, this)) {
				let comStr = this.prefix + cmd.command + ' ', embed = {
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
						value: '`' + cmd.vars.join('` `') + '`',
					});
				}
				log.debug(time(), 'Posting help (args)');
				return msg.channel.send({embed});
			} else {
				return msg.channel.send(`Could not find command \`${arg}\``);
			}
		}
	}
}
