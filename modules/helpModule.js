const log = require('debug-logger')('help-module');
const {modules} = require('../etc/moduleLoader.js');
const {time} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'help';
	this.description = 'Display command help';
	this.extraDesc = 'Command arguments in the help will display a quick summary of the different format a command can take\n' +
					'Arguments surrounded with `[]` are optional, meaning that you can choose to leave it out (do not include the brackets when typing out the command)\n' +
					'Arguments surrounded with `<>` are required, meaning that you have to enter something for it (do not include the brackets when typing out the command)\n' +
					'Arguments not surrounded with brackets are fixed, meaning that exactly that input needs to be provided\n' +
					'Arguments with `...` infront of them means that one or more of it can be provided';
	this.arguments = '[command]';
	this.guildOnly = false;

	/* TO DO:
	 * Implement paging based on categories
	*/
	this.exec((msg, arg) => {
		if (!arg) {
			let embed = {
				title: 'Options',
				description: 'Available commands',
				color: 0xBB0000,
				fields: []
			};

			for (let [cmd, moduleObj] of modules) {
				if (moduleObj.access(msg.author, msg.guild)) {
					embed.fields.push({
						name: this.config.prefix + cmd,
						value: moduleObj.description,
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
			if (cmd && cmd.access(msg.author, msg.guild)) {
				let comStr = this.config.prefix + cmd.command + ' ', embed = {
					title: arg,
					description: cmd.description,
					color: 0xBB0000,
					fields: [],
				};

				if (cmd.extraDesc) embed.description += '\n' + cmd.extraDesc;
				if (cmd.hasExec) {
					embed.fields.push({
						name: 'Command Usage:',
						value: cmd.arguments.map(val => comStr + val).join('\n') || comStr,
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
	});
});
