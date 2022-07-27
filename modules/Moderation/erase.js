class LessThan extends Error {}

this.description = 'erase a number of messages from a user or from all users';
this.arguments = '[count] [...#channel] [...@user]';
this.permissions = 'MANAGE_MESSAGES';

addConfig('default_clear', Number, { default: 50, description: 'default number of messages to clear', configurable: true });
addConfig('message_limit', Number, { default: 1000, description: 'max number of messages to check through to delete', configurable: true });
addConfig('clear_old', Boolean, { default: true, description: 'allow the clearing for messages older than two weeks (clearing these messages is much slower)', configurable: true });

function inGuild () {
	const { DiscordAPIError, Collection } = discordjs,
		{ sendMessage } = Utils,
		config = this.config;

	async function getMessages (channel, users, number) {
		let messages = new Collection(), totalFetched = 0, fetchCount = number;

		while (messages.size < number && totalFetched < config.message_limit) {
			let msgs, limit = 100, before;

			if (fetchCount < limit) {
				limit = fetchCount;
				fetchCount += 10;
			}

			if ((totalFetched + limit) > config.message_limit)
				limit = config.message_limit - totalFetched;

			if (messages.size > 0)
				before = messages.last().id;

			totalFetched += limit;
			msgs = await channel.messages.fetch({ limit, before });

			log.debug('Collected', msgs.size, 'messages in channel', channel.name, 'last message id', messages.last()?.id);
			if (users.size > 0)
				msgs = msgs.filter(msg => users.has(msg.author.id));

			const space = number - messages.size;
			if (msgs.size > space) {
				let count = 0;
				msgs.sweep(() => ++count > space);
			}
			log.debug('Collection of messages reduced to', msgs.size);
			// const tmp = msgs.firstKey(number - messages.size);
			// messages = messages.concat(msgs.filter(msg => tmp.indexOf(msg.id) >= 0));
			messages = messages.concat(msgs);
		}
		log.info('Searched', totalFetched, 'messages, will delete', messages.size);
		return messages;
	}

	async function deleteMessages (channel, messages, number) {
		const failed = [];

		try {
			let count = 0;
			while (messages.size > 0) {
				const chunk = messages.first(100),
					oldMessages = chunk.filter(msg => (Date.now() - msg.createdAt.getTime()) > 1209600000),
					recentMessages = chunk.filter(msg => (Date.now() - msg.createdAt.getTime()) <= 1209600000);

				log.debug('Chunk to bulk delete is:', recentMessages);
				await channel.bulkDelete(recentMessages, true);
				log.debug('Chunk of', recentMessages, 'messages deleted');
				count += recentMessages.length;
				if (oldMessages.length > 0  && config.clear_old) {
					for (const msg of oldMessages) {
						await msg.delete();
						count += 1;
					}
					log.debug('Deleted remaining', oldMessages.length, 'messages');
				}
				chunk.forEach(({ id }) => messages.delete(id));
				log.debug('Remaining messages to delete', messages.size);
			}
			if (count !== number)
				throw new LessThan(`Bulk deleted ${count}/${number} messages, remaining messages are older than 2 weeks`);
		} catch (e) {
			log.error('Unable to delete messages from channel', channel.name, ':', e);
			if (e instanceof DiscordAPIError || e instanceof LessThan) {
				failed.push({ channel, message: e.message });
			} else {
				failed.push({ channel, message: 'internal error, check server logs' });
				log.error(e);
			}
		}
		return failed;
	}

	function handleFailiures ({ failed, msg, number, channels, users }) {
		const send = content => sendMessage(msg.channel, content, { cleanAfter: 10000 });
		if (failed.length === 0) {
			const names = channels.map(channel => channel.name);
			log.info(`${msg.author.username} (${msg.author.id}) erased ${number} messages from ${names.toString()}`);
			log.info('Channel erase targets:', names.toString());
			log.warn('Users targeted by erase:', users.map(user => `${user.nickname || user.username} (${user.id})`).toString());
			return send(`Successfully deleted ${number} messages from: ${names.toString()}`);
		} else if (failed.length > 1) {
			let text = 'Failed to delete messages on some channels:';

			for (const { channel, message } of failed) {
				text += `\n<#${channel.id}>: ${message}`;
				channels.delete(channel.id);
			}
			const names = channels.map(channel => channel.name);
			log.info(`${msg.author.username} (${msg.author.id}) erased ${number} messages from ${names.toString()}`);
			log.warn(text);
			return send(text);
		} else {
			const { channel, message } = failed.pop();
			log.warn(`${msg.author.username} (${msg.author?.id}) failed to erase: <#${channel?.id}> ${message}`);
			return send(`Failed to delete messages in <#${channel.id}>: ${message}`);
		}
	}

	return async (msg, number) => {
		const channels = msg.mentions.channels.filter(tmp => tmp.type === 'text'),
			users = msg.mentions.members, promises = [];
		let failed = [];

		await msg.channel.messages.delete(msg);
		// Setup variables with default values;
		number = Number(number);
		if (isNaN(number))
			number = config.default_clear;
		if (channels.size === 0)
			channels.set(msg.channel.id, msg.channel);

		// Loop through channels and handle message collection/deletion
		for (const channel of channels.values()) {
			promises.push((async () => {
				const messages = await getMessages(channel, users, number);
				return deleteMessages(channel, messages, number);
			})());
		}
		// Process results
		for (const { status, value, reason } of await Promise.allSettled(promises)) {
			if (status === 'fulfilled')
				failed = failed.concat(value);
			else
				log.error('Error handling channel:', reason);
		}
		return handleFailiures({ failed, msg, number, channels, users });
	};
}
