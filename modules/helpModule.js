const log = require('debug-logger')('help-module');
const {modules} = require('../etc/moduleLoader.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'help';
	this.description = 'Display command help';
	this.guildOnly = false;

	this.exec((msg, arg) => {
		if (!arg) {
			let embed = {
				title: 'Options',
				description: 'Available commands',
				color: 0xBB0000,
				fields: []
			};

			for (let [cmd, cmdObj] of modules) {
				let tmp = msg.member;
				if (!tmp || tmp.hasPermission(cmdObj.permissions(msg.guild)))
					embed.fields.push({
						name: cmd,
						value: cmdObj.description,
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
				log.debug(time(), 'Posting help (args)');
				return msg.channel.send({
					embed: {
						title: arg,
						description: cmd.description,
						color: 0xBB0000
					}
				})
			} else {
				return msg.channel.send(`Could not find command \`${arg}\``);
			}
		}
	});
});
