'use strict';

const PageController = require('./controls/PageController.js');
const log = require('./logger.js')('utilities');
const {MessageEmbed, Message, Channel} = require('discord.js');

function trimStr (str, lim) {
	str = String(str);

	if (str.length > lim) {
		str = str.substr(0, lim - 3) + '...';
	}
	return str;
}

class GroupManager {
	#groups = new Map();
	#msgs = new Map();

	constructor () {}

	get #group () {
		let manager = this;
		return class Group {
			#name;
			#page = 0;
			#msgSet = new Set();

			constructor (name) {
				this.#name = name;
			}

			get name () {return this.#name;}

			get page () {return this.#page;}

			set page (page) {
				log.debug('Page of group', this.#name, 'will update from', this.#page, 'to', page);
				if (typeof page === 'number')
					this.#page = page;
				else
					throw new Error('Page input is not a number');
			}

			*messages () {yield* this.#msgSet.values()}

			hasMessage (msg) {return this.#msgSet.has(msg)}

			addMsg (msg) {
				if (msg instanceof Message) {
					if (manager.#msgs.has(msg))
						throw new Error('message cannot be in multiple groups');
					this.#msgSet.add(msg);
					manager.#msgs.set(msg, this);
					log.debug('Added message', msg.id, 'to group', this.#name);
				}
			}

			kill () {
				log.debug('Killing group', this.#name);
				manager.#groups.delete(this.#name);
				for (let msg of this.#msgs) {
					manager.#msgs.delete(msg);
				}
				this.#name = Symbol();
				this.#page = -1;
			}
		}
	}

	get (name) {
		let temp = this.#groups.get(name = String(name));

		if (!temp)
			this.#groups.set(name, temp = new this.#group(name, this));

		return temp;
	}

	with (input) {
		if (input instanceof this.#group)
			return input;
		else
			return this.#msgs.get(input);
	}

	*[Symbol.iterator] () {
		yield* this.#groups.values();
	}

	*messages () {
		yield* this.#msgs;
	}
}

class PagedEmbed {
	#controller;
	#title;
	#pages = [];
	#image;
	#thumb;
	#colour = 0xBB0000;
	#icon;
	#timestamp;
	#active = false;
	#manager = new GroupManager();

	static MAX_ROWS = 25;
	static MAX_TITLE_LENGTH = 256;
	static MAX_DESC_LENGTH = 2048;
	static MAX_FIELD_VALUE_LENGTH = 1024;

	constructor (title, controller) {
		this.#title = title;
		if (controller && controller instanceof PageController)
			this.#controller = controller;
		else
			this.#controller = new PageController.emoji({removeEmote: true});
	}

	addPage (title, rows = [], desc) {
		let tmp = [...rows], hasRun = false;
		if (this.#title)
			title = this.#title + ': ' + title;
		while (tmp.length || !hasRun) {
			this.#pages.push(this.#makeEmbed(title, tmp.splice(0, PagedEmbed.MAX_ROWS), desc));
			if (this.#pages.length == 2) {
				this.#controller.turnOnControls();
			} else if (this.#pages.length > 2) {
				this.#controller.resumeAllControlsExcluding('prev', 'first');
			}
			hasRun = !hasRun;
			title += ' - Continued';
		}
		return this.#pages.length - 1;
	}

	addToPage (pageNo, rows = []) {
		let page = this.#pages[pageNo];

		if (page) {
			let mergedRows = rows.concat(page.fields.map(({name, value}) => [name, value]));
			this.#pages[pageNo] = this.#makeEmbed(page.title, mergedRows, page.description);
		}
	}

	removePage (input) {
		let index;
		if (input instanceof MessageEmbed)
			index = this.#pages.indexOf(input);
		else
			index = Number(input);

		if (index >= 0) {
			this.#pages.splice(index, 1);
			if (this.#pages.length > 1) {
				for (let group of this.#manager) {
					if (group.page == index) {
						if (index) {
							this.#controller.prev(group);
						} else {
							this.#controller.first(group);
						}
					}
				}
			} else {
				this.#controller.stop();
			}
			return true;
		}
		return false;
	}

	setColor (input) {
		if (!isNaN(input = Number(input)))
			this.#colour = input;
	}

	setImage (url) {
		this.#image = String(url);
	}

	setThumbnail (url) {
		this.#thumb = String(url);
	}

	setFooterIcon (iconURL) {
		this.#icon = String(iconURL);
	}

	setTimestamp (input) {
		if (input instanceof Date)
			this.#timestamp = input.valueOf();
		else
			this.#timestamp = Number(input);
	}

	getPage (input) {
		let index;
		if (input instanceof MessageEmbed)
			index = this.#pages.indexOf(input);
		else
			index = Number(input);

		return this.#pages[index];
	}

	async sendTo (channel, group = Symbol()) {
		if (typeof channel === 'object')
		if (!channel || channel instanceof Channel === false)
			throw new Error('Channel required');

		return await this.#makePagedEmbed(channel, String(group));
	}

	#makeEmbed (title, rows, desc) {
		let embed = new MessageEmbed();

		embed.setTitle(trimStr(title, PagedEmbed.MAX_TITLE_LENGTH));
		if (desc)
			embed.setDescription(trimStr(desc, PagedEmbed.MAX_DESC_LENGTH));
		for (let [name, value] of rows) {
			name = trimStr(name, PagedEmbed.MAX_TITLE_LENGTH);
			value = trimStr(value, PagedEmbed.MAX_FIELD_VALUE_LENGTH);
			embed.addField(name, value);
		}
		return embed;
	}

	#setEmbedDefaults (embed) {
		embed.setFooter(`${this.#pages.indexOf(embed) + 1}/${this.#pages.length}`, embed.footer?.iconURL || this.#icon);
		if (!embed.image && this.#image)
			embed.setImage(this.#image);
		if (!embed.thumbnail && this.#thumb)
			embed.setImage(this.#thumb);
		if (!embed.color && this.#colour)
			embed.setColor(this.#colour);
		if (this.#timestamp)
			embed.setTimestamp(this.#timestamp);
		return embed;
	}

	#setupController () {
		let manager = this.#manager;
		log.debug('Attaching events to controller for paged embed');
		this.#controller.on('next', input => {
			let group = manager.with(input);
			group.page++;
			this.#controller.resumeAllControlsExcluding('next', 'last');
			if (group.page >= this.#pages.length - 1) {
				group.page = this.#pages.length - 1;
				this.#controller.pauseControls('next', 'last');
			}
			for (let msg of group.messages()) {
				msg.edit({
					embed: this.#setEmbedDefaults(this.#pages[group.page])
				}).catch(e => {
					log.error('Unable to modify embed', e);
					log.file('ERROR Unable to modify embed', e);
				});
			}
		});
		this.#controller.on('prev', input => {
			let group = manager.with(input);
			group.page--;
			this.#controller.resumeAllControlsExcluding('prev', 'first');
			if (group.page <= 0) {
				group.page = 0;
				this.#controller.pauseControls('prev', 'first');
			}
			for (let msg of group.messages()) {
				msg.edit({
					embed: this.#setEmbedDefaults(this.#pages[group.page])
				}).catch(e => {
					log.error('Unable to modify embed', e);
					log.file('ERROR Unable to modify embed', e);
				});
			}
		});
		this.#controller.on('first', input => {
			let group = manager.with(input);
			group.page = 0;
			this.#controller.resumeAllControlsExcluding('prev', 'first');
			this.#controller.pauseControls('prev', 'first');
			for (let msg of group.messages()) {
				msg.edit({
					embed: this.#setEmbedDefaults(this.#pages[0])
				}).catch(e => {
					log.error('Unable to modify embed', e);
					log.file('ERROR Unable to modify embed', e);
				});
			}
		});
		this.#controller.on('last', input => {
			let group = manager.with(input);
			group.page = this.#pages.length - 1;
			this.#controller.resumeAllControlsExcluding('next', 'last');
			this.#controller.pauseControls('next', 'last');
			for (let msg of group.messages()) {
				msg.edit({
					embed: this.#setEmbedDefaults(this.#pages[group.page])
				}).catch(e => {
					log.error('Unable to modify embed', e);
					log.file('ERROR Unable to modify embed', e);
				});
			}
		});
		this.#controller.on('end', msg => {
			msg.delete().catch(e => {
				log.error('Unable to delete embed', e);
				log.file('ERROR Unable to delete embed', e);
			});
		});
	}

	async #makePagedEmbed (channel, groupName) {
		let group = this.#manager.get(groupName), message;

		if (this.#pages.length === 0)
			throw new Error('No pages have been created');
		if (!this.#active) {
			this.#setupController();
			this.#active = true;
		}
		for (let msg of group.messages()) {
			if (msg.channel.id === channel.id) {
				message = msg;
				break;
			}
		}
		if (!message) {
			let embed = this.#setEmbedDefaults(this.#pages[0]);
			message = await channel.send({embed});
			log.debug('Associating message', message.id, 'with controller, and group', groupName);
			group.addMsg(message);
			// Only attach the contoller if there is more than one page, otherwise navigation is unnecessary
			if (this.#pages.length > 1) {
				this.#controller.pauseControls('first', 'prev');
			} else {
				await this.#controller.turnOffControls();
			}
			this.#controller.addToMessage(message);
		}
		return message;
	}
}


module.exports = PagedEmbed;
