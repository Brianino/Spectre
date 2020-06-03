const log = require('debug-logger')('repost-module');
const {time, getAttachments, getChannelID, checkForUrl, waitFor} = require('../etc/utilities.js');
const {GuildChannel, DiscordAPIError} = require('discord.js');

setupModule(function () {
	this.command = 'repost';
	this.description = 'Repost images into an image gallery channel';
	this.extraDesc = 'At least one source channel needs to be provided, and a gallery channel';
	this.arguments = '<...source> to <gallery>';
	this.permissions = 'MANAGE_GUILD';
	this.guildOnly = true;

	this.addConfig('repost_galleries', Map, new Map(), false);
	this.addConfig('repost_prefer_url', Boolean, true, 'Prefer to post image url\'s rather than reuploading the file');
	this.addConfig('repost_formats', Set, new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']), 'Image formats that should be reposted');

	// ATTACH EVENT LISTENER AFTER THE BOT RESTARTS

	this.bot.once('thisReady', () => {
		if (this.config.repost_galleries.size) {
			let guild = this.bot.guilds.resolve(this.config.id);

			log.info('Attaching repost event for guild', guild? guild.name: this.config.id);
			addEvent.call(this);
		}
	});

	this.exec((msg, ...input) => {
		let [type, gallery, source] = parseInput(input, msg.guild), tmap = this.config.repost_galleries;

		log.debug('Type is:', type);
		switch (type) {
			case 0: // Add/Modify rule
			if (!gallery) return msg.channel.send('Invalid gallery channel');
			if (!source.length) return msg.channel.send('No source channels to scan');
			for (let channel of source) {
				let current = tmap.get(source);

				if (!current) tmap.set(channel, [gallery]);
				else if (current.indexOf(gallery) < 0)
					current.push(gallery);
			}
			this.config.repost_galleries = tmap;
			addEvent.call(this);
			break;

			case 1: // Delete rule
			for (let channel of source) {
				let current = tmap.get(source), ind;

				if (current && (ind = current.indexOf(gallery)) > 0) {
					current.splice(ind, 1);
					if (!current.length) tmap.delete(channel);
				}
			}
			this.config.repost_galleries = tmap;
			break;

			case 2:
			log.debug('Reattaching event on server', msg.guild.name);
			if (this.config.repost_galleries.size) {
				addEvent.call(this);
				return msg.channel.send('Repost rules reloaded');
			}
			break;
		}
	});

	function parseInput (input, guild) {
		let source = [], gallery, tSwitch = false, type = 0;

		switch (input[0]) {
			default:
			for (let val of input) {
				switch (val) {
					case 'to': tSwitch = true; break;

					default:
					if (tSwitch) gallery = getChannelID(val, guild);
					else source.push(getChannelID(val, guild));
					break;
				}
				if (tSwitch && gallery) break;
			}
			break;

			case 'delete': type = 1; gallery = getChannelID(input.slice(1).shift()); break;
			case 'reload': type = 2; break;
		}
		return [type, gallery, source];
	}

	// [-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)

	function addEvent () {
		if (this.bot.listenerCount('message') > 0) return;
		this.bot.on('message', async msg => {
			let gallList = this.config.repost_galleries.get(msg.channel.id) || [], attachments = [], urlCount = checkForUrl(msg.content, true, 'g').length;

			if (msg.author.id === this.bot.user.id) return;
			if (urlCount > 0) {
				await waitFor(10000, 50, async () => {
					await msg.fetch();
					return msg.embeds.length === urlCount;
				});
			}
			attachments = getAttachments(msg, this.config.repost_formats);
			if (!attachments.length) return;
			for (let cid of gallList) {
				let channel = msg.guild.channels.resolve(cid);

				if (channel) {
					let urls = attachments.filter(att => !att.name).map(att => att.url), files = attachments.filter(att => att.name).map(att => {
						return {
							attachment: att.url,
							name: att.name,
						}
					});

					try {
						if (this.config.repost_prefer_url) {
							await channel.send(urls.concat(files.map(att => att.url)).join('\n'));
						} else {
							await channel.send({
								content: urls.join('\n'),
								files: files,
							}).catch(e => {
								return channel.send(urls.concat(files.map(att => att.url)).join('\n'));
							});
						}
					} catch (e) {
						log.error(time(), 'Unable to post to gallery:', e.message);
						log.debug(e.stack);
						if (e instanceof DiscordAPIError)
							return await channel.send('Unable to post image: ' + e.message);
						else {
							return await channel.send('An error occured whilst reposting an image');
						}
					}
				}
			}
		});
	}
});
