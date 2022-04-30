this.description = 'repeat a message';
this.permissions = 'MANAGE_MESSAGES';

this.arguments = '[message to repeat]';

function inGuild (emitter) {
	emitter.on('messageCreate', async msg => {
		if (msg.mentions.users.has(getBot().user.id)) {
			log.debug('Message:', msg.content);
			await msg.reply(`to use my commands use the prefix \`${this.config.prefix}\``);
		}
	});

	return (msg, ...input) => {
		log.debug('Repeating:', input.join(' ').replace(/[\s\S]/g, char => {
			const n = char.charCodeAt();

			return (n < 256) ? char : `\\u${char.charCodeAt().toString(16)
				.toUpperCase()}`;
		}));
		msg.delete().catch(e => {
			log.warn('unable to delete command issuer message');
		});
		if (input[0] === 'dump')
			log.debug(msg);
		if (msg.attachments.size) {
			log.debug('Found', msg.attachments.size, 'attachments in message');
			return msg.channel.send({
				content: input.join(' '),
				files: msg.attachments.map(att => {
					return {
						attachment: att.url,
						name: att.name,
					};
				}),
			});
		} else {
			return msg.channel.send({ content: input.join(' '), allowedMentions: { parse: []}});
		}
	};
}
