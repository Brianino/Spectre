const log = require('debug-logger')('serverinfo-module');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'say';
	this.description = 'repeat a message';
	this.permissions = 'MANAGE_MESSAGES';
	this.guildOnly = true;

	this.exec((msg, ...input) => {
		log.debug('Repeating:', escape(input.join(' ')));
		return msg.channel.send(input.join(' '), {disableMentions: 'all'});
	});
});
