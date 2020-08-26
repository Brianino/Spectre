const log = require('../etc/logger.js')('server-management-module');
const {time} = require('../etc/utilities.js');
const {owner} = require('../config.json');

setupModule(function () {
	this.command = 'servers';
	this.description = 'lists all the servers the bot is in';
	this.limit = ['users', owner];
	this.guildOnly = false;

	this.exec(msg => {
		let guilds = this.bot.guilds.cache, embed = {
			title: 'Guilds',
			color: 0xBB0000,
			fields: []
		}

		for (let guild of guilds.values()) {
			embed.fields.push({
				name: guild.name,
				value: guild.id
			});
		}

		return msg.channel.send({embed});
	});
});


setupModule(function () {
	this.command = 'lserver';
	this.description = 'leaves a specified server';
	this.extraDesc = 'use the list servers command to get the server id';
	this.arguments = '<serverid>';
	this.limit = ['users', owner];
	this.guildOnly = false;

	this.exec(async (msg, id) => {
		try {
			await this.bot.guilds.resolve(id).leave();
			return msg.channel.send('Left server');
		} catch (e) {
			log.error(time(), 'unable to leave server:', e.toString());
			return msg.channel.send('Unable to leave server, check logs');
		}
	});
});
