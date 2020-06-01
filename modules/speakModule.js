const log = require('debug-logger')('serverinfo-module');
const {time} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'say';
	this.description = 'repeat a message';
	this.permissions = 'MANAGE_MESSAGES';
	this.guildOnly = true;

	this.exec((msg, ...input) => {
		log.debug('Repeating:', encodeURIComponent(input.join(' ')));
		msg.delete().catch(e => {
			log.warn('unable to delete command issuer message');
		});
		if (input[0] === 'dump') log.debug(msg);
		if (msg.attachments.size) {
			log.debug('Found', msg.attachments.size, 'attachments in message');
			return msg.channel.send({
				content: input.join(' '),
				files: msg.attachments.map(att => {
					return {
						attachment: att.url,
						name: att.name,
					}
				}),
			});
		} else {
			return msg.channel.send(input.join(' '), {disableMentions: 'all'});
		}
	});
});
