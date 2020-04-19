const log = require('debug-logger')('poll-module');
const timespan = require('timespan-parser')('msec');
const {split} = require('../etc/utilities.js');
const time = require('../etc/time.js');

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
	this.arguments = '<question> [...option] [timespan]'
	this.arguments = 'end';
	this.guildOnly = true;

	this.configVar('poll_timespan', String, '5m', 'default timespan for polls, after which it posts the results');
	this.configVar('poll_max', String, '5m', 'max timespan allowed (there is a hard limit of 1 month)');
	this.configVar('poll_reactions', Boolean, true, 'use reactions for voting (only works with 10 or less options)');
	//this.configVar('poll_active', Map, new Map());

	let active = new Map(), activeWarn = new Set();

	this.exec(async (msg, ...input) => {
		let config = this.config(msg.guild), tmp = parseInput(input.join(' '), config), votes;

		if (tmp && !active.has(msg.channel.id)) {
			let emMsg, embed = {
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

			emMsg = await msg.channel.send({embed});
			if (tmp.options.length <= 10 && config.poll_reactions) {
				votes = await reactionPoll(emMsg, tmp, msg.author.id);
			} else {
				votes = await cmdPoll(emMsg, tmp, msg.author.id, config);
			}
			await emMsg.delete();

			embed = {
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
			return msg.channel.send({embed});
		} else if (tmp && !activeWarn.has(msg.channel.id)) {
			let mtmp = await msg.channel.send('Poll is already active in this channel');

			activeWarn.add(msg.channel.id);
			return setTimeout(() => {
				activeWarn.delete(msg.channel.id);
				return mtmp.delete().catch(e => {
					log.warn(time(), 'Unable to delete poll warning message', e.toString());
					log.debug(e.stack);
				});
			}, 10000);
		} else if (tmp === null) {
			let [poll, user] = active.get(msg.channel.id) || [];

			if (msg.author.id === user || msg.member.permissions.has('MANAGE_MESSAGES')) {
				if (poll) return poll.stop();
				return setTimeout(mtmp => {
					return mtmp.delete().catch(e => {
						log.warn(time(), 'Unable to delete poll warning message', e.toString());
						log.debug(e.stack);
					});
				}, 10000, await msg.channel.send('No active poll in this channel'));
			}
		} else {
			return msg.channel.send('The first parameter has to be one of `single` `multi` `end`');
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
			}
			log.debug('Time is', res.time);
			return res;
			break;
			case 'end': return null;
			break;

		}
	}

	async function reactionPoll (poll, obj, owner) {
		let options = new Set(), col, votes;

		for (let i = 1; i <= obj.options.length; i++) {
			let temp;
			if (i < 10) temp = await poll.react(i + '\uFE0F\u20E3');
			else temp = await poll.react('\uD83D\uDD1F');
			log.debug('Got emoji', typeof temp.emoji, temp.emoji.name);
			options.add(temp.emoji);
			log.debug('Added reaction for option', i);
		}
		active.set(poll.channel.id, [col = poll.createReactionCollector((reaction, user) => {
			if (Number.isFinite(obj.limit)) {
				if (col.collected.filter(tmpcol => tmpcol.users.cache.has(user.id)).size >= obj.limit) {
					try {
						reaction.users.remove(user);
					} catch (e) {
						log.debug('unable to remove user reaction');
					}
					return false;
				} else {
					return true;
				}
			}
			return true;
		}, {time: obj.time}), owner]);
		votes = await new Promise(resolve => {
			col.on('end', collected => {
				log.debug('Vote ended, counting up votes', collected.size);
				return resolve(collected.reduce((acc, reaction) => {
					if (options.has(reaction.emoji)) {
						let tmp = [...options.values()];
						if (reaction.users.cache.has(poll.author.id)) {
							acc[tmp.indexOf(reaction.emoji)] = reaction.count - 1;
						} else {
							acc[tmp.indexOf(reaction.emoji)] = reaction.count;
						}
					}
					return acc;
				}, []));
			});
		});
		log.debug('Votes:', votes);
		active.delete(poll.channel.id);
		return votes;
	}

	async function cmdPoll (poll, obj, owner, config) {
		let col, votes;
		active.set(poll.channel.id, [col = poll.channel.createMessageCollector(msg => {
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
		}, {time: obj.time}), owner]);
		votes = await new Promise(resolve => {
			col.on('end', collected => {
				log.debug('Vote ended, counting up votes', collected.size);
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
		active.delete(poll.channel.id);
		return votes;
	}
});
