const log = require('debug-logger')('help-module');
const {modules} = require('../etc/moduleLoader.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'help';
	this.description = 'Display command help';
	this.arguments = '[command]';
	this.guildOnly = false;

	this.exec((msg, arg) => {
		if (!arg) {
			let embed = {
				title: 'Options',
				description: 'Available commands',
				color: 0xBB0000,
				fields: []
			};

			for (let [cmd, moduleObj] of modules) {
				let tmp = msg.member;
				if (!tmp || tmp.hasPermission(moduleObj.permissions(msg.guild)))
					embed.fields.push({
						name: cmd,
						value: moduleObj.description,
						inline: false
					});
			}
			log.debug(time(), 'Posting help (no args)');
			return msg.channel.send({embed});
		} else {
			let cmd = modules.get(arg = String(arg));
			let tmp = msg.member;

			arg = arg.replace(/`/g, '');
			if (arg === '') arg = ' ';
			if (cmd && (!tmp || tmp.hasPermission(cmd.permissions(msg.guild)))) {
				let comStr = msg.content.substr(0,1) + cmd.command + ' ';
				log.debug(time(), 'Posting help (args)');
				return msg.channel.send({
					embed: {
						title: arg,
						description: cmd.description,
						color: 0xBB0000,
						fields: [{
							name: 'Arguments:',
							value: cmd.arguments.map(val => comStr + val).join('\n') || comStr,
						}],
					}
				})
			} else {
				return msg.channel.send(`Could not find command \`${arg}\``);
			}
		}
	});
});
