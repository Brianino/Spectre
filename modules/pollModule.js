const log = require('debug-logger')('poll-module');
const timespan = require('timespan-parser')('msec');
const {split} = require('../etc/utilities.js');
const time = require('../etc/time.js');

const hardlimit = timespan.parse('1 month'), emoteSet = [
	'\u26AA', //WHITE CIRCLE
	'\u26AB', //BLACK CIRCLE
	'\uD83D\uDD34', //RED CIRCLE
	'\uD83D\uDD35', //BLUE CIRCLE
	'\uD83D\uDFE0', //ORANGE CIRCLE
	'\uD83D\uDFE1', //YELLOW CIRCLE
	'\uD83D\uDEF2', //GREEN CIRCLE
	'\uD83D\uDEF3', //PURPLE CIRCLE
	'\uD83D\uDEF4', //BROWN CIRCLE
	'\uD83D\uDEF5', //RED SQUARE
	'\uD83D\uDEF6', //BLUE SQUARE
	'\uD83D\uDEF7', //ORANGE SQUARE
	'\uD83D\uDEF8', //YELLOW SQUARE
	'\uD83D\uDEF9', //GREEN SQUARE
	'\uD83D\uDEFA', //PURPLE SQUARE
	'\uD83D\uDEFB', //BROWN SQUARE
];

setupModule(function () {
	this.command = 'poll';
	this.description = 'create a poll in the channel';
	this.extraDesc = 'single - a poll where you can only vote for one option\n' +
					'multi - a poll where you can specify the max number of votes\n' +
					'dynamic - a poll where options can be added whilst the poll is running (unlimited number of votes)\n' +
					'The default poll type is single\n' +
					'question - the title of the poll (either a single word, or a sentence inside of double quotes, e.g. "this is a question")\n' +
					'option - same format as the question, these are the options users can vote on\n' +
					'add - used to add options to dynamic polls\n' +
					'delete - used to delete the last option in a dynamic poll\n' +
					'list - used to see what polls are active on the server, and the time remaining for each\n' +
					'end - used to end an active poll early\n' +
					'timespan - the time period the poll should run for (`Important` ensure that if left out that the last option isn\'t valid timespan format)\n' +
					'valid units for the timespan are: seconds (s, sec, second, seconds), minutes (m, min, minute, minutes), hours (h, hr, hour, hours), days (d, day, days)\n' +
					'the timespan should be a combination of numbers and units\n' +
					'image - to add an image upload the image as part of the command\n' +
					'To vote in polls not using reactions, use the commands `vote [option number]` to vote, and `vote remove [option number]` to remove votes, or `vote list` to votes';

	this.arguments = 'single <question> [...option] [timespan]';
	this.arguments = 'dynamic <question> [...option] [timespan]';
	this.arguments = 'multi <limit> <question> [...option] [timespan]';
	this.arguments = '<question> [...option] [timespan]';
	this.arguments = 'add [...options]';
	this.arguments = 'delete';
	this.arguments = 'list';
	this.arguments = 'end all';
	this.arguments = 'end';
	this.guildOnly = true;

	this.configVar('poll_timespan', String, '5m', 'default timespan for polls, after which it posts the results');
	this.configVar('poll_reactions', Boolean, true, 'use reactions for voting (only works with 10 or less options)');
	//this.configVar('poll_marker', Boolean, false, 'posts a link to the poll message (always updated to be the last message in a channel)');
	//this.configVar('poll_active', Map, new Map(), false);

	let active = new Map(), dynamicPolls = new Set(), activeWarn = new Set();
	//CHECK FOR GUILD LEAK, IT SHOULD BE FIXED

	this.exec(async (msg, ...input) => {
		let config = this.config(msg.guild), tmp = parseInput(input.join(' '), config), votes;

		if (tmp.type === 1) {
			let emMsg, tmpType;

			if (tmp.options.length <= 10 && config.poll_reactions) {
				tmpType = 'reaction';
				votes = await reactionPoll(emMsg = await postPoll(msg, tmp), tmp, msg.author);
			} else {
				let cmdPolls = Array.from(active.values()).filter(({type, channel, guild}) => type === 'MessageCollector' && channel.id === msg.channel.id && guild.id === msg.guild.id);

				tmpType = 'command';
				if (cmdPolls.length > 0) return sendWarning(msg.channel);
				votes = await cmdPoll(emMsg = await postPoll(msg, tmp), tmp, msg.author, config);
			}
			await emMsg.delete();

			if (!votes) log.warn('Undefined votes for poll', tmp.question, 'type', tmpType);
			return postResults(msg, tmp, votes);
		} else if (tmp.type === 2) {
			let list;
			if (msg.member.permissions.has('MANAGE_MESSAGES')) {
				list = Array.from(active.values());
			} else {
				list = Array.from(active.values()).filter(({owner}) => owner.id === msg.author.id);
			}
			list = list.filter(({guild}) => guild.id === msg.guild.id);

			if (tmp.question === 'all') {
				list.forEach(({stop}) => stop());
				return;
			} else {
				let choice;
				if (list.length === 0) return (await msg.channel.send('You are unable to end any polls')).delete({timeout: 10000});
				if (list.length === 1) return list[0].stop();

				choice = await menu(list, msg.channel, msg.author, true);
				choice.forEach(({stop}) => stop());
				return;
			}
		} else if (tmp.type === 3) {
			let list = Array.from(dynamicPolls.values()).map(sym => active.get(sym)), choice;
			if (!msg.member.permissions.has('MANAGE_MESSAGES')) {
				list = list.filter(({owner}) => owner.id === msg.author.id);
			}
			list = list.filter(({guild}) => guild.id === msg.guild.id);

			if (list.length === 0)
				return (await msg.channel.send('There are no dynamic polls you can modify running right now')).delete({timeout: 10000});
			if (list.length === 1) choice = list[0];
			else choice = await menu(list, msg.channel, msg.author, false);

			for (let option of tmp.options) {
				try {
					let added = await choice.add(option);

					if (added) return;

					return (await msg.channel.send('Cannot have more than 10 options')).delete({timeout: 10000});
				} catch (e) {
					log.error(time(), 'error modifying dynamic poll');
					log.error(e);
					return (await msg.channel.send('An error occured whilst modifying the poll')).delete({timeout: 10000});
				}
			}
		} else if (tmp.type === 4) {
			let list = Array.from(dynamicPolls.values()).map(sym => active.get(sym)), choice;
			if (!msg.member.permissions.has('MANAGE_MESSAGES')) {
				list = list.filter(({owner}) => owner.id === msg.author.id);
			}
			list = list.filter(({guild}) => guild.id === msg.guild.id);

			if (list.length === 0)
				return (await msg.channel.send('There are no dynamic polls you can modify running right now')).delete({timeout: 10000});
			if (list.length === 1) choice = list[0];
			else choice = await menu(list, msg.channel, msg.author, false);

			try {
				return await choice.delete();
			} catch (e) {
				log.error(time(), 'error modifying dynamic poll');
				log.error(e);
				return (await msg.channel.send('An error occured whilst modifying the poll')).delete({timeout: 10000});
			}
		} else if (tmp.type === 5) {
			let list = Array.from(active.values()).filter(({guild}) => guild.id === msg.guild.id);
			log.debug('Active:', active.size, 'filtered down to', list.length);
			return (await pollList(list, msg.channel, msg.author)).delete({timeout: 10000});
		} else {
			return (await msg.channel.send('Missing parameters, refer to help')).delete({timeout: 10000});
		}
	});

	function parseInput (input, config) {
		let [type, question, ...options] = split(input),
			res = {type: 1, question, options};

		switch (type) {
			default: res.question = type; res.options.unshift(question);
			case 'single': res.limit = 1; break;
			case 'dynamic': res.dynamic = true; res.limit = Infinity; break;
			case 'multi': res.limit = Number(question);
			res.question = options.shift();
			break;

			case 'list': return {type: 5}; break;
			case 'add': return {type: 3, options: [question, ...options]}; break;
			case 'delete_last': return {type: 4}; break;
			case 'end': res.type = 2; return res; break;
		}
		try {
			res.time = timespan.parse(options[options.length - 1]);
			options.pop();
		} catch (ignore) {
			log.debug('Last poll option is not a timespan:', ignore.toString());
			res.time = timespan.parse(config.poll_timespan);
			if (res.time > hardlimit) res.time = hardlimit;
		}
		if (isNaN(res.limit) || !res.question) return undefined;
		log.debug('Time is', res.time);
		return res;
	}

	function postPoll (msg, tmp) {
		let embed = {
			title: 'Poll: ' + tmp.question,
			description: tmp.options.map((val, i) => `**${i + 1}:** ${val}`).join('\n'),
			color: 0xBB0000,
			footer: {
				text: 'Poll from ' + msg.author.tag,
				icon_url: msg.author.avatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}

		log.debug('Creating poll', tmp.question, 'for user', msg.author.tag);
		if (msg.attachments.size) {
			let temp = msg.attachments.first();

			embed.image = {url: 'attachment://' + temp.name};
			return msg.channel.send({embed: embed, files: [{attachment: temp.url, name: temp.name}]});
		} else {
			return msg.channel.send({embed});
		}
	}

	function editPoll (msg, tmp, owner, attachment) {
		let embed = {
			title: 'Poll: ' + tmp.question,
			description: tmp.options.map((val, i) => `**${i + 1}:** ${val}`).join('\n'),
			color: 0xBB0000,
			footer: {
				text: 'Poll from ' + owner.tag,
				icon_url: owner.avatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}

		log.debug('Modifying poll', tmp.question, 'for user', owner.tag);
		if (attachment) {
			embed.image = {url: 'attachment://' + attachment.name};
			return msg.edit({embed: embed, files: [{attachment: attachment.url, name: attachment.name}]});
		} else if (msg.attachments.size) {
			let temp = msg.attachments.first();

			embed.image = {url: 'attachment://' + temp.name};
			return msg.edit({embed: embed, files: [{attachment: temp.url, name: temp.name}]});
		} else {
			return msg.edit({embed});
		}
	}

	function postResults (msg, tmp, votes = []) {
		let embed = {
			title: tmp.question + ' - results',
			description: '',
			color: 0xBB0000,
			footer: {
				text: 'Poll from ' + msg.author.tag,
				icon_url: msg.author.avatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}
		for (let i = 0; i < tmp.options.length; i++) {
			embed.description += `${tmp.options[i]}: ${votes[i] || 0} votes\n`;
		}

		if (msg.attachments.size) {
			let temp = msg.attachments.first();

			embed.image = {url: 'attachment://' + temp.name};
			return msg.channel.send({embed: embed, files: [{attachment: temp.url, name: temp.name}]});
		} else {
			return msg.channel.send({embed});
		}
	}

	function pollList (list, channel, author, footerMsg) {
		let menu, choice, embed = {
			title: 'Active Polls:',
			fields: [],
			color: 0xBB0000,
			footer: {
				text: footerMsg || 'List of Polls',
				icon_url: author.avatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}

		list.forEach(({owner, title, end}, i) => {
			log.debug('Listing poll', title, end, 'from', owner.username);
			embed.fields.push({
				name: `${i + 1} - ${title}`,
				value: `By ${owner.tag} - ${timespan.getString(Math.ceil((end - Date.now()) / 1000), 's')} remaining`,
			});
		});

		return channel.send({embed});
	}

	async function menu (list, channel, author, allAllowed) {
		let choice, menu = await pollList(list, channel, author, allAllowed ? 'Enter the index number, or all, or cancel' : 'Enter the index number, or cancel');

		choice = await channel.awaitMessages(msg => {
			if (msg.author.id === author.id) {
				let i = Number(msg.content);
				if ((!isNaN(i) && i > 0 && i <= list.length) || msg.content === 'cancel' || (msg.content === 'all' && allAllowed)) {
					msg.delete().catch(e => log.warn(time(), 'Unable to delete poll choice message', e.toString()));
					return true;
				}
			}
			return false;
		}, {max: 1, time: 30000});
		await menu.delete().catch(e => log.warn(time(), 'Unable to delete menu message', e.toString()));
		if (choice.first()) {
			let temp = choice.first().content, i = Number(temp);

			log.debug('Choice is', i, 'msg:', temp);
			if (!isNaN(i) && i > 0) {
				log.debug('returning option', i);
				return allAllowed ? [list[i - 1]] : list[i - 1];
			} else if (temp === 'all') {
				log.debug('returning all');
				return [...list];
			}
		}
		return allAllowed ? [] : undefined;
	}

	async function sendWarning (channel) {
		if (activeWarn.has(channel.id)) return;
		(await channel.send('Poll is already active in this channel')).delete({timeout: 10000})
			.then(() => activeWarn.delete(channel.id))
			.catch(e => {
				activeWarn.channel.delete(channel.id);
				log.warn(time(), 'Unable to delete poll warning message', e.toString());
			});
		activeWarn.add(channel.id);
		return;
	}


	function handlePoll (collector, {dynamic, question, time, owner, channel, guild, ...func}, filter) {
		return new Promise(resolve => {
			let ind = Symbol('identifier');

			active.set(ind, {
				stop: collector.stop.bind(collector),
				add: func.add,
				delete: func.delete,
				owner: owner,
				title: question,
				channel: channel,
				guild: guild,
				end: Date.now() + time,
				type: collector.constructor.name,
			});

			collector.on('collect', filter);
			collector.on('dispose', msg => log.debug('Removed', msg.id, msg.content));

			if (dynamic) dynamicPolls.add(ind);

			collector.on('end', collected => {
				log.debug(question, 'ended, counting up votes');
				active.delete(ind);
				dynamicPolls.delete(ind);
				resolve(collected);
			});
		});
	}

	async function reactionPoll (pollMsg, obj, owner) {
		let options = new Set(), collector, collected, tmp = Object.assign({
			owner: owner,
			guild: pollMsg.guild,
			channel: pollMsg.channel,
			add: async (option, attachment) => {
				let temp;

				if (options.size >= 10) return false;
				pollMsg = await editPoll(pollMsg, {question: obj.question, options: [...obj.options, option]}, owner, attachment);
				if (options.size < 9) temp = await pollMsg.react(`${options.size + 1}\uFE0F\u20E3`);
				else temp = await pollMsg.react('\uD83D\uDD1F');

				options.add(temp.emoji.name);
				log.debug('Added reaction for option', options.size, 'emote', temp.emoji.name);
				obj.options.push(option);
				return true;
			},
			delete: async () => {
				let last = [...options].pop(), newopt = obj.options.slice(0, -1);

				log.debug('last:', last.constructor.name);
				await pollMsg.reactions.cache.find(reac => reac.emoji.name === last).remove();
				pollMsg = await editPoll(pollMsg, {question: obj.question, options: newopt}, owner);
				options.delete(last);
				obj.options = newopt;
				return true;
			}
		}, obj);

		for (let i = 1; i <= obj.options.length; i++) {
			let temp;
			if (i < 10) temp = await pollMsg.react(i + '\uFE0F\u20E3');
			else temp = await pollMsg.react('\uD83D\uDD1F');
			options.add(temp.emoji.name);
			log.debug('Added reaction for option', i, 'emote', temp.emoji.name);
		}

		collector = pollMsg.createReactionCollector(reaction => options.has(reaction.emoji.name), {time: obj.time});
		collected = await handlePoll(collector, tmp, async (reaction, user) => {
			let count = pollMsg.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && options.has(reaction.emoji.name)).size;

			if (count > obj.limit && user.id !== user.client.user.id) {
				log.debug('Count of reactions for user', user.username, 'is', count, 'of', obj.limit);
				log.debug('Reactions:', ...pollMsg.reactions.cache.map((reaction, key) => key + '-' + reaction.count));
				await reaction.users.remove(user);
			}
		});

		return [...options].map(name => {
			let reaction = collected.find(reaction => reaction.emoji.name === name);
			if (!reaction) return 0;
			else if (reaction.me) return reaction.count - 1;
			else return reaction.count;
		});
	}


	async function cmdPoll (pollMsg, obj, owner, config) {
		let collector, collected, tmp = Object.assign({
			owner: owner,
			guild: pollMsg.guild,
			channel: pollMsg.channel,
			add: async (option, attachment) => {
				pollMsg = await editPoll(pollMsg, {question: obj.question, options: [...obj.options, option]}, owner, attachment);
				obj.options.push(option);
				return true;
			},
			delete: async () => {
				let newopt = obj.options.slice(0, -1);
				pollMsg = await editPoll(pollMsg, {question: obj.question, options: newopt}, owner);
				obj.options = newopt;
				return true;
			}
		}, obj);

		collector = pollMsg.channel.createMessageCollector(msg => msg.content.startsWith(config.prefix + 'vote'), {time: obj.time});
		collected = await handlePoll(collector, tmp, async msg => {
			let parts = msg.content.split(' ').slice(1), input = parts[0], i = Number(input);

			msg.delete().catch(e => log.debug('unable to delete vote removal message'));
			if (!isNaN(i) && i <= obj.options.length && i > 0) {
				let existing = collector.collected.filter(tmsg => tmsg.author.id === msg.author.id), count = existing.size,
					copies = existing.filter(tmsg => Number(tmsg.content.split(' ')[1]) === i).size;
				if (count <= obj.limit && copies < 2) {
					(await msg.reply('vote registered')).delete({timeout: 5000});
				} else {
					log.debug('Count of votes for user', msg.author.username, 'is', count, 'of', obj.limit);
					log.debug('Existing:', copies);
					collector.collected.delete(msg.id);
				}
			} else {
				collector.collected.delete(msg.id);
				switch (input) {
					case 'remove': i = Number(parts[1]);
					if (parts[1] && !isNaN(i)) {
						let existing = collector.collected.find(tmsg => tmsg.author.id === msg.author.id && Number(tmsg.content.split(' ')[1]) === i);
						if (existing) {
							collector.collected.delete(existing.id);
							(await msg.reply('removed specified vote')).delete({timeout: 5000});
						}
					} else {
						collector.collector.filter(tmsg => tmsg.author.id === msg.author.id).forEach(tmsg => collector.collected.delete(tmsg.id));
						(await msg.reply('removed all votes')).delete({timeout: 5000});
					}
					break;

					case 'list':
					let votes = collector.collected.filter(tmsg => tmsg.author.id === msg.author.id).map(tmsg => Number(tmsg.content.split(' ')[1]));
					(await msg.reply('you have voted for options: ' + votes.join(' '))).delete({timeout: 5000});
				}
			}
		});

		return collected.reduce((acc, msg) => {
			try {
				acc[Number(msg.content.split(' ')[1] - 1)] += 1;
			} catch (e) {log.warn('Invalid vote:', msg.content)};
			return acc;
		}, obj.options.map(val => 0));
	}
});
