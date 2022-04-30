import AbstractController from './AbstractController.js';
import logger from '../../core/logger.js';
import TwoWayMap from '../TwoWayMap.js';

const log = logger('Utilities');

// Eslint file specific config
/*
eslint
no-unused-vars: ["error", { "args": "all", "argsIgnorePattern": "^_" }]
class-methods-use-this: ["warn", {
	"exceptMethods": [
		"_onAdd",
		"_onRemove",
		"_onEnable",
		"_onDisable",
		"_onResume",
		"_onPause",
		"_onPausedEvent",
		"_setupMessage",
		"_onEvent",
		"_onEnd",
		"_getCollector",
		"_fetchValue",
		"_checkStop"
	]
}] */

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
class EmojiController extends AbstractController {
	#removeEmote = true;
	#allowUserStop = true;
	#attached = false;

	static STOP_EMOTE = '\u23F9\uFE0F';
	static ReservedEmoteError = class ReservedEmoteError extends Error {};

	constructor ({ removeEmote, allowUserStop, ...other } = {}, eventToEmote) {
		super(other, eventToEmote ? eventToEmote = new TwoWayMap(eventToEmote) : undefined);
		if (eventToEmote && eventToEmote.hasValue(EmojiController.STOP_EMOTE))
			throw new EmojiController.ReservedEmoteError(`${EmojiController.STOP_EMOTE} is reserved`);
		if (removeEmote !== undefined)
			this.#removeEmote = removeEmote;
		if (allowUserStop !== undefined)
			this.#allowUserStop = allowUserStop;
	}

	static #getReaction (msg, emote) {
		return msg.reactions.cache.find(reaction => reaction.emoji.name === emote);
	}

	#addReaction (emote, msgs = this._messages.keys())  {
		const promises = [];
		for (const msg of msgs) {
			promises.push((async () => {
				log.debug(`Adding emote ${emote} to message ${msg.id}`);
				if (EmojiController.#getReaction(msg, emote)?.me)
					return log.debug(`Emote ${emote} already present on ${msg.id}`);
				await msg.react(String(emote));
				return emote;
			})());
		}
		return Promise.allSettled(promises);
	}

	#removeReaction (emote, msgs = this._messages.keys()) {
		const promises = [];
		for (const msg of msgs) {
			promises.push((async () => {
				const reaction = EmojiController.#getReaction(msg, emote);
				if (reaction) {
					try {
						await reaction.remove();
					} catch (e) {
						log.warn('Unable to remove all users on reaction', emote);
						await reaction.users.remove();
					}
					return emote;
				}
			})());
		}
		return Promise.allSettled(promises);
	}

	async _onAdd (emote) {
		for (const { status, reason } of await this.#addReaction(emote)) {
			if (status === 'rejected')
				log.warn('Unable to add emote', emote, 'because', reason);
		}
	}

	async _onRemove (emote) {
		for (const { status, reason } of await this.#removeReaction(emote)) {
			if (status === 'rejected')
				log.warn('Unable to remove emote', emote, 'because', reason);
		}
	}

	async _onEnable (emotes) {
		const promises = [];
		for (const emote of emotes)
			promises.push(this._onAdd(emote));
		await Promise.all(promises);
	}

	async _onDisable (emotes) {
		const promises = [];
		for (const emote of emotes)
			promises.push(this._onRemove(emote));
		await Promise.all(promises);
	}

	async _setupMessage (msg, emotes) {
		let promises = [];
		log.debug('Setting up message', msg.id);
		if (this.isEnabled()) {
			for (const emote of emotes)
				promises.push(this.#addReaction(emote, [msg]));
		}
		if (this.#allowUserStop)
			promises.push(this.#addReaction(EmojiController.STOP_EMOTE, [msg]));
		promises = await Promise.all(promises);
		for (const { status, reason } of promises.flat()) {
			if (status === 'rejected')
				log.warn('Unable to setup msg because', reason);
		}
	}

	async _onEvent (reaction, user) {
		if (this.#removeEmote) {
			try {
				await reaction.users.remove(user);
			} catch (e) {
				if (e.message === 'Missing Permissions') {
					log.warn('Turning off reaction removal due to missing permissions');
					this.#removeEmote = false;
				} else {
					log.error('Unable to remove reaction', e);
				}
			}
		}
	}

	async _onPausedEvent (reaction, user) {
		await this._onEvent(reaction, user);
	}

	async _onEnd (msg, emotes) {
		let promises = [];
		for (const emote of emotes)
			promises.push(this.#removeReaction(emote, [msg]));
		if (this.#allowUserStop)
			promises.push(this.#removeReaction(EmojiController.STOP_EMOTE, [msg]));
		promises = await Promise.all(promises);
		for (const { status, reason } of promises.flat()) {
			if (status === 'rejected')
				log.warn('Unable to cleanup msg because', reason);
		}
	}

	_getCollector ({ message, time, idle }) {
		const filter = (_r, u) => (u.id !== u.client.user.id);
		return message.createReactionCollector({ filter, time, idle });
	}

	_fetchValue (reaction, _user) {
		return reaction.emoji.toString();
	}

	_checkStop (reaction, _user) {
		if (this.#allowUserStop) {
			if (this._fetchValue(reaction) === EmojiController.STOP_EMOTE)
				return true;
		}
		return false;
		// check if the event triggers a stop;
	}

	/** Adds a new control to the controller
	 * @override
	 * @param {string|symbol} event - the name of the control/emitted event
	 * @param {string}        assoc - value used to trigger the control in the collector
	 * @return {EmojiController} returns the object to allow for chaining
	*/
	addControl (event, assoc) {
		if (assoc === EmojiController.STOP_EMOTE)
			throw new EmojiController.ReservedEmoteError(`${EmojiController.STOP_EMOTE} is reserved`);
		return super.addControl(event, assoc);
	}

	*emotes () {
		yield* this.assoc();
	}
}

export default EmojiController;
