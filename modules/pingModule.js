const log = require('debug-logger')('ping-module');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'ping';
	this.description = 'get the ping to discord';
	this.guildOnly = false;

	this.exec(msg => {
		return msg.channel.send('Pong ' + this.bot.ws.ping + 'ms');
	});
});
