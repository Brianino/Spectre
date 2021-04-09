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
		return class group {
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

			messages () {return this.#msgSet.values()}

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

	with (msg) {
		return this.#msgs.get(msg);
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

	constructor (title, controller) {
		this.#title = title;
		if (controller && controller instanceof PageController)
			this.#controller = controller;
		else
			this.#controller = new PageController.emoji({removeEmote: true});
	}

	addPage (title, options, desc) {
		if (this.#title)
			title = this.#title + ': ' + title;
		this.#pages.push(this.#makeEmbed(title, options, desc));
		return this.#pages.length - 1;
	}

	addToPage (pageNo, options) {
		let page = this.#pages[pageNo];

		if (page) {
			let mergedOptions = options.concat(page.fields.map(({name, value}) => [name, value]));
			this.#pages[pageNo] = this.#makeEmbed(page.title, mergedOptions, page.description);
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

	#makeEmbed (title, options, desc) {
		let embed = new MessageEmbed();

		if (options.length > 25)
			throw new Error('Cannont contain more than 25 options');

		embed.setTitle(trimStr(title, 256));
		if (desc)
			embed.setDescription(trimStr(desc, 2048));
		for (let [name, value] of options) {
			name = trimStr(name, 256);
			value = trimStr(value, 1024)
			embed.addField(name, value);
		}
		log.debug('Page created:', embed);
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
		this.#controller.on('next', msg => {
			let group = manager.with(msg);
			if (group.page >= this.#pages.length - 1)
				return;
			group.page++;
			msg.edit({
				embed: this.#setEmbedDefaults(this.#pages[group.page])
			}).catch(e => {
				log.error('Unable to modify embed', e);
				log.file('ERROR Unable to modify embed', e);
			});
		});
		this.#controller.on('prev', msg => {
			let group = manager.with(msg);
			if (group.page <= 0)
				return;
			group.page--;
			msg.edit({
				embed: this.#setEmbedDefaults(this.#pages[group.page])
			}).catch(e => {
				log.error('Unable to modify embed', e);
				log.file('ERROR Unable to modify embed', e);
			});
		});
		this.#controller.on('first', msg => {
			if (manager.with(msg).page == 0)
				return;
			manager.with(msg).page = 0;
			msg.edit({
				embed: this.#setEmbedDefaults(this.#pages[0])
			}).catch(e => {
				log.error('Unable to modify embed', e);
				log.file('ERROR Unable to modify embed', e);
			});
		});
		this.#controller.on('last', msg => {
			let group = manager.with(msg);
			if (group.page === this.#pages.length - 1)
				return;
			group.page = this.#pages.length - 1;
			msg.edit({
				embed: this.#setEmbedDefaults(this.#pages[group.page])
			}).catch(e => {
				log.error('Unable to modify embed', e);
				log.file('ERROR Unable to modify embed', e);
			});
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
			this.#controller.addToMessage(message);
		}
		return message;
	}
}


module.exports = PagedEmbed;
