'use strict';

import logger from '../../core/logger.js';
import TwoWayMap from '../TwoWayMap.js';
import { Message } from 'discord.js';
import events from 'events';

const log = logger('Utilities');

/** Extra properties object
 * @typedef {Object} emojiControllerProperties
 * @prop {number}    [seconds]        - the amount of time the controller should be active for in seconds
 * @prop {number}    [secondsIdle]    - the amount of time the controller should be allowed inactivity time for the controller to stay active
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
	#emoteOrder = new Set();
	#emoteMap = new TwoWayMap();
	#paused = new TwoWayMap();
	#messages = new Map();
	#controlsOn = true;

	static #STOP_EMOTE = '\u23F9\uFE0F';
	static ReservedEmoteError = class ReservedEmoteError extends Error {};
	static ControlExistsError = class ControlExistsError extends Error {};

	constructor ({removeEmote, seconds, secondsIdle = 30, allowUserStop} = {}, emoteToEvent) {
		super();

		if (emoteToEvent instanceof Map)
			this.#emoteMap = new TwoWayMap(emoteToEvent);
		if (typeof seconds === 'number')
			this.#options.time = seconds * 1000;

		this.#emoteMap.forEach((val, key) => this.#emoteOrder.add(key));
		this.#options.idle = Number(secondsIdle) * 1000;
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
			throw new EmojiController.ReservedEmoteError('The emote ' + emoteName + ' is reserved');
		if (this.#emoteMap.has(emoteName) || this.#paused.hasValue(emoteName))
			throw new EmojiController.ControlExistsError(`Emote ${emoteName} exists already`);
		if (this.#emoteMap.hasValue(evName) || this.#paused.has(evName))
			throw new EmojiController.ControlExistsError(`Control for ${evName} exists already`);
		this.#emoteMap.set(emoteName, evName);
		this.#emoteOrder.add(emoteName);
		return this;
	}

	/** Adds all the emoji as well as enabling all the controls
	 * @return {Promise} will resolve once all the controls have been paused
	*/
	async turnOnControls () {
		if (!this.#controlsOn) {
			let promises = [];
			this.#controlsOn = true;
			for (let msg of this.#messages.keys())
				promises.push(this.#attachReactions(msg));
			await Promise.allSettled(promises);
		}
	}

	/** Removes a control from the controller
	 * @param {string} evName - the name of the control to remove
	 * @return {Promise} will resolve once the emote has been removed
	*/
	async removeControl (evName) {
		let emote = this.getEventEmote(evName = String(evName));
		if (this.#emoteMap.delete(emote) || this.#paused.delete(evName)) {
			this.#emoteOrder.delete(emote);
			await this.#removeReaction(emote);
		}
	}

	/** Removes all the emoji as well as disabling all but the stop control
	 * @return {Promise} will resolve once all the controls have been paused
	*/
	async turnOffControls () {
		if (this.#controlsOn) {
			this.#controlsOn = false;
			if (this.#messages.size) {
				let promises = [];
				for (let emote of this.emotes()) {
					promises.push(this.#removeReaction(emote));
				}
				await Promise.allSettled(promises);
			}
		}
	}

	/** Re-enables a paused control
	 * @param {string} evName - the name of the control to enable
	 * @return {boolean} true if the control was paused and then enabled
	*/
	resumeControl (evName) {
		let value = this.#paused.get(evName = String(evName));

		if (value) {
			log.debug('Control', evName, 'resumed');
			this.#paused.delete(evName);
			this.#emoteMap.set(value, evName);
			return true;
		}
		return false;
	}

	/** Re-enables paused controls
	 * @param {...string} names - the names of the controls to enable
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeControls (...names) {
		let res = false, nameSet = new Set(names);
		for (let evName of this.#paused.keys()) {
			if (nameSet.has(evName)) {
				this.resumeControl(evName);
				res = true;
				nameSet.delete(evName);
				if (!nameSet.size)
					break;
			}
		}
		return res;
	}

	/** Re-enables all paused controls
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeAllControls () {
		let res = this.#paused.size > 0;
		for (let evName of this.#paused.keys()) {
			this.resumeControl(evName);
		}
		return res;
	}

	/** Re-enables all (excluding the specified) paused controls
	 * @param {...string} names - the names of the controls to not update
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeAllControlsExcluding (...names) {
		let evNames = [...this.#paused.keys()].filter(val => !names.includes(val));
		return this.resumeControls(...evNames);
	}

	/** Temporarily disables a control
	 * @param {string} evName - the name of the control to disable
	 * @return {boolean} true if the control was enabled and then paused
	*/
	pauseControl (evName) {
		let value = this.getEventEmote(evName = String(evName));

		if (value) {
			log.debug('Control', evName, 'paused');
			this.#emoteMap.delete(value);
			this.#paused.set(evName, value);
			return true;
		}
		return false;
	}

	/** Temporarily disables controls
	 * @param {...string} names - the names of the controls to disable
	 * @return {boolean} true if any of the controls were enabled and then paused
	*/
	pauseControls (...names) {
		let res = false;
		for (let evName of names) {
			res = this.pauseControl(evName) || res;
		}
		return res;
	}

	/** Temporarily disables all (excluding the specified) controls
	 * @param {...string} names - the names of the controls to not update
	 * @return {boolean} true if any of the controls were enabled and then paused
	*/
	pauseAllControlsExcluding (...names) {
		let res = false, nameSet = new Set(names);
		for (let evName of this.#emoteMap.values()) {
			if (!nameSet.has(evName))
				res = this.pauseControl(evName) || res;
		}
		return res;
	}

	/** Returns the name of the emote that triggers a control
	 * @param {string} evName - the name of the control
	 * @return {string} the name of the emote
	*/
	getEventEmote (evName) {
		return this.#emoteMap.getByValue(evName);
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

	/** Stops the contoller on the specified messages, If msgs is not provided it will default to 'all'
	 * @param {(string|Message[])} msgs - the list of message objects, or 'all' for all of them, where the controller will stop on the specified messages
	*/
	stop (msgs) {
		msgs = msgs ?? 'all';
		if (msgs === 'all') {
			for (let col of this.#messages.values())
				col.stop();
		} else {
			for (let msg of msgs)
				this.#messages.get(msg)?.stop();
		}
	}

	/** Overrides this emit method to check if a control exists/is enabled, otherwise it won't emit
	 * @Override
	 * @param {string}  evName - The name of the event to emit
	 * @param {...args} args   - Extra args to pass on to the parent method
	*/
	emit(evName, ...args) {
		if (this.getEventEmote(evName) || evName === 'end') {
			super.emit(evName, ...args);
		}
	}

	/** Cleans up function to remove the reactions and remove the message from the local store once the reaction collector ends
	 * @private
	 * @param {Message} msg - the message object
	*/
	#cleanUp (msg) {
		msg.reactions.removeAll().catch(e => {
			log.warn('Unable to remove reaction:', e);
		});
		this.#messages.delete(msg);
	}

	#checkReaction (reaction, getControl = false) {
		if (getControl)
			return this.#emoteMap.get(reaction.emoji.toString()) || this.#paused.getByValue(reaction.emoji.toString());
		else
			return this.#emoteMap.has(reaction.emoji.toString()) || this.#paused.hasValue(reaction.emoji.toString());
	}

	#getReaction (msg, emote) {
		return msg.reactions.cache.find(reaction => reaction.emoji.name === emote);
	}

	async #attachReactions (msg) {
		for (let emote of this.#emoteOrder) {
			try {
				if (this.#getReaction(msg, emote)?.me)
					continue;
				await msg.react(String(emote));
			} catch (e) {
				log.warn('Unable to add emote', String(emote), 'to message:', e);
			}
		}
		if (this.#options.allowUserStop) {
			this.#emoteMap.set(EmojiController.#STOP_EMOTE, undefined);
			try {
				if (this.#getReaction(msg, EmojiController.#STOP_EMOTE)?.me !== true)
					await msg.react(EmojiController.#STOP_EMOTE);
			} catch (e) {
				log.debug('Stop unicode:', EmojiController.#STOP_EMOTE);
				log.warn('Unable to add stop emote to message:', e);
			}
		}
	}

	async #removeReaction (emoteName, msgs) {
		let tmp = new Set(msgs ?? this.#messages.keys()), promises = [];
		for (let msg of tmp) {
			promises.push(this.#getReaction(msg, emoteName)?.remove());
		}
		await Promise.allSettled(promises).then(res => {
			let failed = res.filter(({status}) => status === 'rejected');
			log.warn('Failed to remote emote', emoteName, 'from', failed.length, 'messages');
		});
	}

	#controlHandler (msg) {
		let collector, filter = (r, u) => this.#controlsOn && this.#checkReaction(r) && (u.id != u.client.user.id);

		if (this.#messages.has(msg))
			return;

		if (this.#controlsOn)
			this.#attachReactions(msg);
		collector = msg.createReactionCollector(filter, {time: this.#options.time, idle: this.#options.idle});
		this.#messages.set(msg, collector);

		collector.on('collect', (reaction, user) => {
			let evName = this.#checkReaction(reaction, true);

			if (evName) {
				if (this.#options.removeEmote) {
					reaction.users.remove(user).catch(e => {
						if (e.message === 'Missing Permissions') {
							log.warn('Turning off reaction removal due to missing permissions');
							this.#options.removeEmote = false;
						} else {
							log.error('Unable to remove reaction', e);
						}
					});
				}
				try {
					this.emit(evName, msg);
				} catch (e) {
					log.warn('Control event failed:', e);
				}
			} else if (this.#options.allowUserStop && reaction.emoji.toString() === EmojiController.#STOP_EMOTE) {
				collector.stop();
			}
		});
		collector.on('end', () => {
			try {
				this.#cleanUp(msg);
				this.emit('end', msg);
			} catch (e) {
				log.warn('Control end event failed:', e);
			}
		});
	}

	*allControls () {
		yield* this.#emoteMap.values();
		yield* this.#paused.keys();
	}

	*activeControls () {
		yield* this.#emoteMap.values();
	}

	*pausedControls () {
		yield* this.#paused.keys();
	}

	*emotes () {
		yield* this.#emoteMap.keys();
		yield* this.#paused.values();
	}

	*[Symbol.iterator] () {
		yield* this.#emoteMap.entriesByValue();
		yield* this.#paused;
	}
}

export default EmojiController;
