'use strict';

const log = require('../logger.js')('utilities');
const {Message} = require('discord.js');
const events = require('events');

/** Extra properties object
 * @typedef {Object} emojiControllerProperties
 * @prop {number}    [seconds]        - the amount of time the controller should be active for in seconds
 * @prop {boolean}   [removeEmote]    - true if it should try to remove user reactions
 * @prop {boolean}   [allowUserStop]  - true if a stop button should be added for the user to manually stop the controller
*/

/** Emote based message controls
 *
 * @param {emojiControllerProperties} [param]        - options to change the behaviour of the controller
 * @param {Map}                       [emoteToEvent] - map of emote names to event names to start with
*/
class EmojiController extends events {
	#options = {};
	#emoteMap = new Map();
	#messages = new Map();
	#paused = new Map();

	static #STOP_EMOTE = '\u23F9\uFE0F';
	static ReservedEmoteError = class ReservedEmoteError extends Error {};

	constructor ({removeEmote, seconds, allowUserStop} = {}, emoteToEvent) {
		super();

		if (emoteToEvent instanceof Map)
			this.#emoteMap = emoteToEvent;
		if (typeof seconds === 'number')
			this.#options.time = (seconds ?? 30) * 1000;

		this.#options.removeEmote = removeEmote ?? true;
		this.#options.allowUserStop = allowUserStop ?? true;
	}

	/** Adds a new control to the controller
	 *
	 * @param {string} evName    - the name of the control, will also be the name of the emitted event
	 * @param {string} emoteName - the name of the emote that will trigger the control.
	 * @return {emojiController} returns the object to allow for chaining
	*/
	addControl (evName, emoteName) {
		emoteName = String(emoteName), evName = String(evName);
		if (this.#options.allowUserStop && emoteName === EmojiController.#STOP_EMOTE)
			throw new this.ReservedEmoteError('The emote ' + emoteName + ' is reserved');
		this.#emoteMap.set(emoteName, evName);
		return this;
	}

	/** Removes a control from the controller
	 * @param {string} evName - the name of the control to remove
	 * @return {Promise} will resolve once the emote has been removed
	*/
	async removeControl (evName) {
		let emote = this.getEventEmote(String(evName));
		if (this.#emoteMap.delete(emote)) {
			await this.#removeReaction(emoteName);
		}
	}

	/** Re-enables a paused control
	 * @param {string} evName - the name of the control to enable
	 * @return {boolean} true if the control was paused and then enabled
	*/
	resumeControl (evName) {
		let value = this.#paused.get(evName = String(evName));

		if (value) {
			this.#paused.delete(evName);
			this.#emoteMap.set(value, evName);
			return true;
		}
		return false;
	}

	/** Temporarily disables a control
	 * @param {string} evName - the name of the control to disable
	 * @return {boolean} true if the control was enabled and then disabled
	*/
	pauseControl (evName) {
		let value = this.getEventEmote(evName = String(evName));

		if (value) {
			this.#emoteMap.delete(value);
			this.#paused.set(evName, value);
			return true;
		}
		return false;
	}

	/** Returns the name of the emote that triggers a control
	 * @param {string} evName - the name of the control
	 * @return {string} the name of the emote
	*/
	getEventEmote (evName) {
		for (let [emote, event] of this.#emoteMap) {
			if (evName === event)
				return emote;
		}
	}

	/** Adds the controller to the specified discord message
	 * @param {Message} msg - the discord.js message object
	 * @return {emojiController} returns the object to allow for chaining
	*/
	addToMessage (msg) {
		if (msg instanceof Message === false)
			throw new Error('A discord message object is required');
		this.#controlHandler(msg);
		return this;
	}

	/** Stops the contoller on the specified messages
	 * @param {(string|Message[])} msgs - the list of message objects, or 'all' for all of them, where the controller will stop on the specified messages
	*/
	stop (msgs) {
		msgs = msgs ?? 'all';
		if (msgs === 'all') {
			for (let [msg, col] of this.#messages) {
				this.#stopCol(msg, col);
			}
		} else {
			for (let msg of msgs) {
				let col = this.#messages.get(msg);

				if (col)
					this.#stopCol(msg, col);
			}
		}
	}

	/** Stops the reaction collector, and emits the end event
	 * @private
	 * @param {Message}           msg - the message object
	 * @param {ReactionCollector} col - the reaction collector that needs to be ended
	*/
	#stopCol (msg, col) {
		msg.reactions.removeAll().catch(e => {
			log.warn('Unable to remove reaction:', e);
			log.file('WARN Unable to remove reaction:', e);
		});
		col.stop();
		this.#messages.delete(msg);
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
		if (this.#options.allowUserStop) {
			this.#emoteMap.set(EmojiController.#STOP_EMOTE, undefined);
			try {
				await msg.react(EmojiController.#STOP_EMOTE);
			} catch (e) {
				log.debug('Stop unicode:', EmojiController.#STOP_EMOTE);
				log.warn('Unable to add stop emote to message:', e);
				log.file('WARN Unable to add stop emote to message:', e);
			}
		}
	}

	async #removeReaction (emoteName, msgs) {
		msgs = msgs ?? this.#messages.keys();

		for (let msg of msgs) {
			try {
				let reaction = msg.reactions.cache.find(reaction => reaction.emoji.name === emoteName);

				if (reaction)
					await reaction.remove();
			} catch (e) {
				log.error('Unable to remove reaction', e);
				log.file('ERROR Unable to remove reaction:', e);
			}
		}
	}

	#controlHandler (msg) {
		let collector, filter = (r, u) => (this.#emoteMap.has(r.emoji.toString()) || log.debug('couldn\'t find emoji:', r.emoji.toString())) && (u.id != u.client.user.id);

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
			} else if (this.#options.allowUserStop && reaction.emoji.toString() === EmojiController.#STOP_EMOTE) {
				this.#stopCol(msg, collector);
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

module.exports = EmojiController;
