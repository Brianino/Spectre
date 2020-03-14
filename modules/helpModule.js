const log = require('debug-logger')('help-module');
const {modules} = require('../etc/moduleLoader.js');
const {RichEmbed} = require('discord.js')
const time = require('../etc/time.js');

setupModule('help', function () {
	this.command = 'help';
	this.description = 'Display command help';
	this.guildOnly = false;

	this.exec((msg, arg) => {
		if (!arg) {
			let embed = new RichEmbed({title: 'Options'});

			embed.setColor('RED').setDescription('Available commands');
			for (let [cmd, cmdObj] of modules) {
				let tmp = msg.member;
				if (!tmp || tmp.hasPermission(cmdObj.permissions(msg.guild)))
					embed.addField(cmd, cmdObj.description);
			}
			log.debug(time(), 'Posting help (no args)');
			return msg.channel.send(undefined, embed);
		} else {
			// this should be individual command help but.....nothing is in place for this yet
			let embed = new RichEmbed({title: arg}), cmd = modules.get(arg = String(arg));
			let tmp = msg.member;

			arg = arg.replace(/`/g, '');
			if (arg === '') arg = ' ';
			if (cmd && (!tmp || tmp.hasPermission(cmd.permissions(msg.guild)))) {
				embed.setColor('RED').setDescription(cmd.description);
				//embed.addField(cmd.command, cmd.description);
				log.debug(time(), 'Posting help (args)');
				return msg.channel.send(undefined, embed);
			} else {
				return msg.channel.send(`Could not find command \`${arg}\``);
			}
		}
	});
});
