const log = require('debug-logger')('help-module');
const modules = require('../etc/moduleLoader.js');
const {RichEmbed} = require('discord.js')
const time = require('../etc/time.js');

setupModule('help', function () {
	this.command = 'help';
	this.description = 'a module for displaying command help';

	this.exec((msg, args) => {
		if (!args) {
			let embed = new RichEmbed({title: 'Options'});

			embed.setColor('RED').setDescription('Available commands');
			for (let [cmd, cmdObj] of modules) {
				embed.addField(cmd, cmdObj.description);
			}
			log.debug(time(), 'Posting help (no args)');
			return msg.channel.send(undefined, embed);
		} else {
			// this should be individual command help but.....nothing is in place for this yet
			let embed = new RichEmbed({title: 'Options'});

			embed.setColor('RED').setDescription('Available commands');
			for (let [cmd, cmdObj] of modules) {
				embed.addField(cmd, cmdObj.description);
			}
			log.debug(time(), 'Posting help (args, not implemented yet)');
			return msg.channel.send(undefined, embed);
		}
	})
});
