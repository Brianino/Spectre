const log = require('../etc/logger.js')('serverinfo-module');
const {time, checkForUrl, waitFor} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'say';
	this.description = 'repeat a message';
	this.permissions = 'MANAGE_MESSAGES';
	this.guildOnly = true;

	this.bot.on('message', async msg => {
		if (msg.mentions.users.has(this.bot.user.id)) {
			log.debug('Message:', msg.content);
			await msg.reply('Hewwo');
		}
	})

	this.exec(async (msg, ...input) => {
		log.debug('Repeating:', input.join(' ').replace(/[\s\S]/g, char => {
			let n = char.charCodeAt();

			return (n < 256) ? char : '\\u' + char.charCodeAt().toString(16).toUpperCase();
		}));
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
