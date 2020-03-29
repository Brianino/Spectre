const log = require('debug-logger')('wipe-module');
const {modules} = require('../etc/moduleLoader.js');
const {guildConfig} = require('../etc/guildConfig.js');
const {MessageMentions, DiscordAPIError, Collection} = require('discord.js');
const time = require('../etc/time.js');

class lessThan extends Error {};

setupModule(function () {
	this.command = 'erase';
	this.description = 'erase a number of messages from a user or from all users';
	this.arguments = '[count] [...#channel] [...@user]';
	this.permissions = 'MANAGE_MESSAGES'
	this.guildOnly = true;

	this.exec(async (msg, number) => {
		let channels = msg.mentions.channels.filter(tmp => tmp.type === 'text');
			users = msg.mentions.members, roles = msg.mentions.roles, failed = [];

		number = Number(number);
		msg.delete();
		if (isNaN(number)) number = guildConfig(msg.guild.id).defaultClear;
		if (channels.size === 0) channels.set(msg.channel.id, msg.channel);
		for (let channel of channels.values()) {
			let messages = new Collection(), sum = 0, limit = guildConfig(msg.guild.id).messageLimit, i = 0;

			while (messages.size < number && sum < limit) {
				let msgs, tmp, obj = {limit: null};

				obj.limit = number * (i || 1);
				if (obj.limit > 100) obj.limit = 100;
				if (sum + obj.limit > limit) obj.limit = limit - sum;
				if (messages.size > 0) obj.before = messages.last().id;
				sum += obj.limit;
				msgs = await channel.messages.fetch(obj);

				log.debug(time(), 'Collected', msgs.size, 'messages in channel', channel.name, 'last message id', messages.size ? messages.last().id : undefined);
				if (users.size > 0) msgs = msgs.filter(msg => users.has(msg.author.id));
				// figure out something for roles....  msgs.filter(msg => msg.member.roles.cache.intersect(roles).size > 0)
				log.debug(time(), 'Collection of messages reduced to', msgs.size);
				tmp = msgs.firstKey(number - messages.size);
				messages = messages.concat(msgs.filter(msg => tmp.indexOf(msg.id) >= 0));
				i += 10;
			}
			log.info(time(), 'Searched', sum, 'messages, will delete', messages.size);
			try {
				let count = 0;
				while (messages.size > 0) {
					let chunk = messages.first(100), temp = chunk.filter(msg => Date.now() - msg.createdAt.getTime() > 1209600000);

					await channel.bulkDelete(chunk, true);
					log.debug(time(), 'Chunk of', chunk.length - temp.length, 'messages deleted');
					count += chunk.length - temp.length;
					if (temp.length > 0  && guildConfig(msg.guild.id).clearOld) {
						for (let msg of temp) {
							await msg.delete();
							count += 1;
						}
						log.debug(time(), 'Deleted remaining', temp.length, 'messages');
					}
					chunk.forEach(msg => messages.delete(msg.id));
					log.debug(time(), 'Remaining messages to delete', messages.size);
				}
				if (count !== number)
					throw new lessThan('Deleted ' + count + '/' + number + ' messages');
			} catch (e) {
				log.error(time(), 'Unable to delete messages from channel', channel.name, 'because', e.message);
				if (e instanceof DiscordAPIError || e instanceof lessThan) {
					failed.push({channel, message: e.message});
				} else {
					failed.push({channel, message: 'internal error, check server logs'});
					log.error(e);
				}
			}
		}
		if (failed.length === 0) {
			return msg.channel.send('Successfully deleted ' + number + ' messages from each channel');
		} else if (failed.length > 1) {
			let text = 'Failed to delete messages on some channels:'
			for (let obj of failed) {
				text+= '\n<#' + obj.channel.id + '>: ' + obj.message;
			}
			return msg.channel.send(text);
		} else {
			return msg.channel.send('Failed to delete messages in <#' + failed[0].channel.id + '>: ' + failed[0].message);
		}
	});
});
