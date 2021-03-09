'use strict';
const log = require('../logger.js')('utilities');
const {Message} = require('discord.js');
const events = require('events');


module.exports = class emojiController extends events {
	#options = {
		// add stop emote
		allowUserStop: true,
		removeEmote: true,
		time: 300000
	}
	#emoteMap = new Map();
	#messages = new Map();

	constructor ({removeEmote, seconds} = {}, emoteToEvent) {
		super();

		if (emoteToEvent instanceof Map)
			this.#emoteMap = emoteToEvent;
		if (typeof seconds === 'number')
			this.#options.time = seconds * 1000;
		if (typeof removeEmote === 'boolean')
			this.#options.removeEmote = removeEmote;
	}

	addControl (evName, emoteName) {
		this.#emoteMap.set(emoteName, evName);
		return this;
	}

	addToMessage (msg) {
		if (msg instanceof Message === false)
			throw new Error('A discord message object is required');
		this.#controlHandler(msg);
		return this;
	}

	stop (msgs) {
		if (msgs === 'all') {
			for (let [msg, col] of this.#messages) {
				col.stop();
				this.#messages.delete(msg);
				try {
					this.emit('end', msg);
				} catch (e) {
					log.warn('Control end event failed:', e);
					log.file('ERROR control end event failed:', e);
				}
			}
		} else {
			for (let msg of msgs) {
				let col = this.#messages.get(msg);

				if (col) {
					col.stop();
					this.#messages.delete(msg);
				}
				try {
					this.emit('end', msg);
				} catch (e) {
					log.warn('Control end event failed:', e);
					log.file('ERROR control end event failed:', e);
				}
			}
		}
	}

	async #attachReactions (msg) {
		for (let emote of this.#emoteMap.keys()) {
			try {
				await msg.react(String(emote));
			} catch (e) {
				log.warn('Unable to add emote', String(emote), 'to message:', e);
				log.file('WARN Unable to add emote', String(emote), 'to message:', e);
			}
		}
	}

	#controlHandler (msg) {
		let collector, filter = (r, u) => this.#emoteMap.has(r.emoji.toString()) && (u.id != u.client.user.id) || log.debug('couldn\'t find emoji:', r.emoji.toString());

		if (this.#messages.has(msg))
			return;

		this.#attachReactions(msg).catch(e => {
			log.error('Unable to attach reactions to message:', e);
			log.file('ERROR Unable to attach reactions to message');
			if (collector)
				collector.stop();
		});
		collector = msg.createReactionCollector(filter, {time: this.#options.time});
		this.#messages.set(msg, collector);

		collector.on('collect', (reaction, user) => {
			let evName = this.#emoteMap.get(reaction.emoji.toString());

			if (evName) {
				if (this.#options.removeEmote) {
					reaction.users.remove(user).catch(e => {
						if (e.message === 'Missing Permissions') {
							log.warn('Turning off reaction removal due to missing permissions');
							this.#options.removeEmote = false;
						} else {
							log.error('Unable to remove reaction', e);
							log.file('ERROR Unable to remove reaction:', e);
						}
					});
				}
				try {
					this.emit(evName, msg);
				} catch (e) {
					log.warn('Control event failed:', e.toString());
					log.file('ERROR control event failed:', e);

				}
			}
		});
		collector.on('end', () => {
			try {
				this.emit('end', msg)
			} catch (e) {
				log.warn('Control end event failed:', e);
				log.file('ERROR control end event failed:', e);
			}
		});
	}
}
