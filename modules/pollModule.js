const log = require('debug-logger')('poll-module');
const timespan = require('timespan-parser')('msec');
const {MessageCollector} = require('discord.js');
const {split} = require('../etc/utilities.js');
const time = require('../etc/time.js');

const hardlimit = timespan.parse('1 month');

setupModule(function () {
	this.command = 'poll';
	this.description = 'create a poll in the channel';
	this.extraDesc = 'A single choice poll only allows a single choice\n' +
					'A multi choice poll allows multiple selections\n' +
					'use `end` to end the poll that is active on the current channel\n' +
					'only the poll owner or a user with `MANAGE_MESSAGES` can end the poll\n' +
					'The timespan should be made up of:\n'+
					'- Seconds - s, sec, second, seconds\n' +
					'- Minutes - m, min, minute, minutes\n' +
					'- Hours - h, hr, hour, hours\n' +
					'- Days - d, day, days\n' +
					'Double quotes can be used to mark the boundaries of the parameters\n' +
					'Only a single poll can be active on a channel at once\n' +
					'When voting with commands the commands allowed are: \n' +
					'- `vote [option number]` to vote for an option\n' +
					'- `rvote` to clear existing votes';
	this.arguments = 'single <question> [...option] [timespan]';
	this.arguments = 'multi <question> [...option] [timespan]';
	this.arguments = '<question> [...option] [timespan]';
	this.arguments = 'end all';
	this.arguments = 'end';
	this.guildOnly = true;

	this.configVar('poll_timespan', String, '5m', 'default timespan for polls, after which it posts the results');
	this.configVar('poll_reactions', Boolean, true, 'use reactions for voting (only works with 10 or less options)');
	//this.configVar('poll_marker', Boolean, false, 'posts a link to the poll message (always updated to be the last message in a channel)');
	//this.configVar('poll_active', Map, new Map(), false);

	let active = new Map(), activeWarn = new Set();

	this.exec(async (msg, ...input) => {
		let config = this.config(msg.guild), tmp = parseInput(input.join(' '), config), votes;

		if (typeof tmp === 'object') {
			let emMsg;

			if (tmp.options.length <= 10 && config.poll_reactions) {
				votes = await reactionPoll(emMsg = await postPoll(msg, tmp), tmp, msg.author);
			} else {
				let cmdPolls = Array.from(active.values()).filter(([poll]) => poll instanceof MessageCollector);

				if (cmdPolls.length > 0) return sendWarning(msg.channel);
				votes = await cmdPoll(emMsg = await postPoll(msg, tmp), tmp, msg.author, config);
			}
			await emMsg.delete();

			return postResults(msg, tmp, votes);
		} else if (typeof tmp === 'string') {
			let list;
			if (msg.member.permissions.has('MANAGE_MESSAGES')) {
				list = Array.from(active.values());
			} else {
				list = Array.from(active.values()).filter(([poll, owner]) => owner.id === msg.author.id);
			}

			if (tmp === 'all') {
				for (let [poll] of list) {
					poll.stop();
				}
				return;
			}
			if (list.length === 0) return (await msg.channel.send('You are unable to end any polls')).delete({timeout: 10000});
			if (list.length === 1) return list[0][0].stop();
			return pollChoices(list, msg.channel, msg.author);
		} else {
			return (await msg.channel.send('Missing parameters, refer to help')).delete({timeout: 10000});
		}
	});

	function parseInput (input, config) {
		let [type, question, ...options] = split(input),
			res = {question, options};

		switch (type) {
			default: res.question = type; res.options.unshift(question);
			case 'single': res.limit = 1;
			case 'multi': if (!res.limit) res.limit = Infinity;
			try {
				res.time = timespan.parse(options[options.length - 1]);
				options.pop();
			} catch (ignore) {
				log.debug('Last poll option is not a timespan:', ignore.toString());
				res.time = timespan.parse(config.poll_timespan);
				if (res.time > hardlimit) res.time = hardlimit;
			}
			log.debug('Time is', res.time);
			return res;
			break;

			case 'end': return question || '';
			break;
		}
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

	function postResults (msg, tmp, votes) {
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

	async function pollChoices (list, channel, author) {
		let menu, choice, embed = {
			title: 'Active Polls:',
			fields: [],
			color: 0xBB0000,
			footer: {
				text: 'Enter the index number of the poll to end, or all, or cancel',
				icon_url: author.avatarURL({
					format: 'png',
					dynamic: true,
				}),
			}
		}

		list.forEach(([poll, owner, title, end], i) => {
			log.debug('Listing poll', title, end, 'from', owner.username);
			embed.fields.push({
				name: `${i + 1} - ${title}`,
				value: `By ${owner.tag} - ${timespan.getString(Math.ceil((end - Date.now()) / 1000), 's')} remaining`,
			});
		});

		menu = await channel.send({embed});
		choice = await channel.awaitMessages(msg => {
			if (msg.author.id === author.id) {
				let i = Number(msg.content);
				if ((!isNaN(i) && i > 0 && i <= list.length) || msg.content === 'cancel' || msg.content === 'all') {
					msg.delete().catch(e => {
						log.warn(time(), 'Unable to delete poll choice message', e.toString());
					});
					return true;
				}
			}
			return false;
		}, {max: 1, time: 30000});

		if (choice.first()) {
			let temp = choice.first().content, i = Number(temp);

			log.debug('Choice is', i, 'msg:', choice.first().content);
			if (!isNaN(i) && i > 0) list[i - 1][0].stop();
			else if (temp === 'all') {
				for (let [poll] of list) {
					poll.stop();
				}
			}
			return menu.delete();
		}
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

	async function reactionPoll (poll, obj, owner) {
		let options = new Set(), col, votes, ind = Symbol('identifier');

		for (let i = 1; i <= obj.options.length; i++) {
			let temp;
			if (i < 10) temp = await poll.react(i + '\uFE0F\u20E3');
			else temp = await poll.react('\uD83D\uDD1F');
			log.debug('Got emoji', typeof temp.emoji, temp.emoji.name);
			options.add(temp.emoji);
			log.debug('Added reaction for option', i);
		}
		active.set(ind, [col = poll.createReactionCollector((reaction, user) => {
			if (!options.has(reaction.emoji)) return false;
			if (Number.isFinite(obj.limit)) {
				if (col.collected.filter(val => val.users.resolve(user.id)).size > obj.limit) {
					try {
						reaction.users.remove(user);
					} catch (e) {
						log.debug('unable to remove user reaction');
					}
					return false;
				} else {
					log.debug('user hasn\'t voted yet', user.username);
					return true;
				}
			}
			return true;
		}, {time: obj.time}), owner, poll.embeds[0].title, Date.now() + obj.time]);
		votes = await new Promise(resolve => {
			col.on('end', collected => {
				log.debug(poll.embeds[0].title, 'ended, counting up votes');
				return resolve(collected.reduce((acc, reaction) => {
					if (options.has(reaction.emoji)) {
						let tmp = [...options.values()];
						if (reaction.me) {
							acc[tmp.indexOf(reaction.emoji)] = reaction.count - 1;
						} else {
							acc[tmp.indexOf(reaction.emoji)] = reaction.count;
						}
					}
					return acc;
				}, []));
			});
		});
		log.debug(poll.embeds[0].title, 'votes:', votes);
		if (!active.delete(ind)) {
			log.debug('Unable to find poll', poll.embeds[0].title);
		}
		return votes;
	}

	async function cmdPoll (poll, obj, owner, config) {
		let col, votes, ind = Symbol('identifier');
		active.set(ind, [col = poll.channel.createMessageCollector(msg => {
			if (msg.content.startsWith(config.prefix + 'vote')) {
				let input = msg.content.split(' ')[1];

				msg.delete().catch(e => {
					log.debug('unable to delete vote message');
				});
				if (isNaN(Number(input))) {
					return false;
				} else {
					if (Number.isFinite(obj.limit)) {
						if (col.collected.filter(val => val.author.id === msg.author.id).size >= obj.limit) {
							return false;
						} else {
							log.debug('user hasn\'t voted yet', col.collected.size, col.collected.map(val => val.author.id));
							return true;
						}
					}
					return true;
				}
			} else if (msg.content.startsWith(config.prefix + 'rvote')) {
				msg.delete().catch(e => {
					log.debug('unable to delete vote removal message');
				});
				for (let temp of col.collected.values()) {
					if (temp.author.id === msg.author.id) {
						col.collected.delete(temp.id);
						log.debug('Removed vote from:', temp.author.username);
					}
				}
			}
			return false;
		}, {time: obj.time}), owner, poll.embeds[0].title, Date.now() + obj.time]);
		votes = await new Promise(resolve => {
			col.on('end', collected => {
				log.debug(poll.embeds[0].title, 'ended, counting up votes');
				return resolve(collected.reduce((acc, message) => {
					let m = message.content.split(' ')[1];
					if (Number(m) < obj.options.length) {
						let option = Number(m);
						if (acc[option - 1]) acc[option] += 1;
						else acc[option - 1] = 1;
					}
					return acc;
				}, []));
			});
		});
		log.debug(poll.embeds[0].title, 'votes:', votes);
		if (!active.delete(ind)) {
			log.debug('Unable to find poll', poll.embeds[0].title);
		}
		return votes;
	}
});
