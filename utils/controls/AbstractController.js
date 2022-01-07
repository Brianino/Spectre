import logger from '../../core/logger.js';
import TwoWayMap from '../TwoWayMap.js';
import { Message } from 'discord.js';
import events from 'events';

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
		"_setupMessage",
		"_onEvent",
		"_onPausedEvent",
		"_onEnd",
		"_getCollector",
		"_fetchValue",
		"_checkStop"
	]
}] */

/** Extra properties object
 * @typedef {Object} ControllerProperties
 * @prop {number}    [seconds]        - the max amount of time the controller should be active for in seconds
 * @prop {number}    [secondsIdle]    - the amount of time the controller should be allowed inactivity time for the controller to stay active
*/

/** Emote based message controls
 *
 * @param {ControllerProperties}      [param]      - options to change the behaviour of the controller
 * @param {Map}                       [controlMap] - iterable of event name to associated term
*/
class AbstractController extends events {
	_messages = new Map();
	#secondsMax;
	#secondsIdle = 30000;
	#controlMap = new TwoWayMap();
	#paused = new Set();
	#queue = new Set();
	#controlsOn = true;

	static ControlExistsError = class ControlExistsError extends Error {};
	static END_EVENT = 'end';
	static ERROR_EVENT = 'error';

	constructor ({ seconds, secondsIdle = 30 } = {}, controlMap) {
		super();

		if (this.constructor === AbstractController)
			throw new Error('Cannot instantiate abstract class');
		if (typeof controlMap[Symbol.iterator] === 'function')
			this.#controlMap = new TwoWayMap(controlMap);
		if (typeof seconds === 'number')
			this.#secondsMax = seconds * 1000;
		if (typeof secondsIdle === 'number')
			this.#secondsIdle = secondsIdle * 1000;
		for (const [event, value] of this.#controlMap) {
			const converted = AbstractController.#convertEventName(event);
			AbstractController.#checkReserverd(converted);
			if (event !== converted) {
				this.#controlMap.delete(event);
				this.#controlMap.set(converted, value);
			}
		}
	}

	static #checkReserverd (event) {
		switch (event) {
			case AbstractController.END_EVENT:
			case AbstractController.ERROR_EVENT:
				throw new AbstractController.ControlExistsError(`${event} is a reserved control`);
		}
	}

	static #convertEventName (event) {
		if (typeof event === 'symbol')
			return event;
		else
			return String(event);
	}

	async _onAdd (_assoc) {
		// do something with assoc after add;
	}

	async _onRemove (_assoc) {
		// do something with assoc after remove;
	}

	async _onEnable (_assocItt) {
		// do something with iterator of assoc after enable;
	}

	async _onDisable (_assocItt) {
		// do something with iterartor of assoc after disable;
	}

	async _onResume (_assoc) {
		// do something with assoc after resume;
	}

	async _onPause (_assoc) {
		// do something with assoc after pause;
	}

	async _setupMessage (_message, _assocItt) {
		// Run setup on the message
	}

	async _onEvent (..._eventArgs) {
		// do something during collect;
	}

	async _onPausedEvent (..._eventArgs) {
		// do something during collect of paused event;
	}

	async _onEnd (_message, _assocItt) {
		// do something with the message after
	}

	_getCollector ({ _message, _time, _idle }) {
		throw new Error('Get collector method hasn\'t been defined');
		// Return an instance of a collector
	}

	_fetchValue (..._eventArgs) {
		// get the assoc value based on the event arguments;
	}

	_checkStop (..._eventArgs) {
		// check if the event triggers a stop;
	}

	#addActionToQueue (action, ...args) {
		log.debug(`Adding action ${action} to queue (Args: ${args.toString()})`);
		const promise = (async () => {
			await this[action](...args);
			log.debug(`Action ${action} finished running (Args: ${args.toString()})`);
		})();
		this.#queue.add(promise);
		promise.catch(e => {
			log.error(`Action ${action} failed (Args: ${args.toString()})`);
			this.emit('error', e);
		});
		promise.then(() => {
			log.debug(`Removing action ${action} from queue (Args: ${args.toString()})`);
			this.#queue.delete(promise);
		});
	}

	get actions () {
		return Promise.all(this.#queue);
	}

	get actionsSettled () {
		return Promise.allSettled(this.#queue);
	}

	/** Adds a new control to the controller
	 *
	 * @param {string|symbol} event - the name of the control/emitted event
	 * @param {string}        assoc - value used to trigger the control in the collector
	 * @return {AbstractController} returns the object to allow for chaining
	*/
	addControl (event, assoc) {
		event = AbstractController.#convertEventName(event);
		assoc = String(assoc);
		AbstractController.#checkReserverd(event);
		if (this.#controlMap.has(event) || this.#paused.has(event))
			throw new AbstractController.ControlExistsError(`Control ${event} exists already`);
		if (this.#controlMap.hasValue(assoc) || this.#paused.hasValue(assoc))
			throw new AbstractController.ControlExistsError(`Control associated value ${assoc} exists already`);
		this.#controlMap.set(event, assoc);
		this.#addActionToQueue('_onAdd', assoc);
		return this;
	}

	/** Removes a control from the controller
	 * @param {string} event - the name of the control to remove
	 * @return {boolean} true if the control existed before being removed
	*/
	removeControl (event) {
		event = AbstractController.#convertEventName(event);
		const assoc = this.#controlMap.get(event);
		if (assoc) {
			this.#controlMap.delete(event);
			this.#paused.delete(event);
			this.#addActionToQueue('_onRemove', assoc);
			return true;
		}
		return false;
	}

	/** Enables all the controls */
	turnOnControls () {
		if (!this.#controlsOn) {
			log.debug('Turned on all controls');
			this.#controlsOn = true;
			this.#addActionToQueue('_onEnable', this.assoc());
		}
	}

	/** Disable all the controls */
	turnOffControls () {
		if (this.#controlsOn) {
			log.debug('Turned off all controls');
			this.#controlsOn = false;
			this.#addActionToQueue('_onDisable', this.assoc());
		}
	}

	/** Re-enables a paused control
	 * @param {string} event - the name of the control to enable
	 * @return {boolean} true if the control was paused and then enabled
	*/
	resumeControl (event) {
		if (this.#paused.has(event = AbstractController.#convertEventName(event))) {
			log.debug(`Resumed control ${event}`);
			this.#paused.delete(event);
			this.#addActionToQueue('_onResume', this.#controlMap.get(event));
			return true;
		}
		return false;
	}

	/** Re-enables paused controls
	 * @param {...string} names - the names of the controls to enable
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeControls (...names) {
		let res = false;
		for (const name of names)
			res |= this.resumeControl(name);
		return !!res;
	}

	/** Re-enables all paused controls
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeAllControls () {
		const res = this.#paused.size > 0;
		for (const event of this.#paused)
			this.resumeControl(event);
		return res;
	}

	/** Re-enables all (excluding the specified) paused controls
	 * @param {...string} names - the names of the controls to not update
	 * @return {boolean} true if any of the controls were paused and then enabled
	*/
	resumeAllControlsExcluding (...names) {
		let res = false;
		names = names.map(name => AbstractController.#convertEventName(name));
		for (const event of this.#paused) {
			if (!names.includes(event))
				res |= this.resumeControl(event);
		}
		return !!res;
	}

	/** Temporarily disables a control
	 * @param {string} event - the name of the control to disable
	 * @return {boolean} true if the control was enabled and then paused
	*/
	pauseControl (event) {
		const value = this.#controlMap.get(event = AbstractController.#convertEventName(event));

		if (value && !this.#paused.has(event)) {
			log.debug(`Paused control ${event}`);
			this.#paused.add(event);
			this.#addActionToQueue('_onPause', value);
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
		for (const event of names)
			res |= this.pauseControl(event);
		return !!res;
	}

	pauseAllControls () {
		let res = false;
		for (const event of this.#controlMap.keys())
			res |= this.pauseControl(event);
		return !!res;
	}

	/** Temporarily disables all (excluding the specified) controls
	 * @param {...string} names - the names of the controls to not update
	 * @return {boolean} true if any of the controls were enabled and then paused
	*/
	pauseAllControlsExcluding (...names) {
		let res = false;
		names = names.map(name => AbstractController.#convertEventName(name));
		for (const event of this.#controlMap.values()) {
			if (!names.includes(event))
				res |= this.pauseControl(event);
		}
		return !!res;
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
			for (const col of this._messages.values())
				col.stop();
		} else {
			for (const msg of msgs)
				this._messages.get(msg)?.stop();
		}
	}

	/** Overrides this emit method to check if a control exists/is enabled, otherwise it won't emit (end events will always emit)
	 * @Override
	 * @param {string}  event - The name of the event to emit
	 * @param {...args} args  - Extra args to pass on to the parent method
	*/
	emit (event, ...args) {
		event = AbstractController.#convertEventName(event);
		if ((this.#controlMap.has(event) && !this.#paused.has(event) && this.#controlsOn) || event === 'end')
			super.emit(event, ...args);
	}

	#controlHandler (msg) {
		if (this._messages.has(msg))
			return;

		const collector = this._getCollector({ message: msg, time: this.#secondsMax, idle: this.#secondsIdle });
		this._messages.set(msg, collector);
		this.#addActionToQueue('_setupMessage', msg, this.assoc());
		collector.on('collect', (...args) => {
			try {
				if (this._checkStop(...args))
					return collector.stop();
				const assoc = this._fetchValue(...args), event = this.#controlMap.getByValue(assoc);

				if (event) {
					if (this.#paused.has(event))
						return this.#addActionToQueue('_onPausedEvent', ...args);
					this.#addActionToQueue('_onEvent', ...args);
					this.emit(event, msg);
				}
			} catch (e) {
				log.error('Control handler failed:', e);
			}
		});

		collector.on('end', () => {
			try {
				this._messages.delete(msg);
				this.#addActionToQueue('_onEnd', msg, this.assoc());
				this.emit(AbstractController.END_EVENT, msg);
			} catch (e) {
				log.error('Control handler end failed:', e);
			}
		});
	}

	*[Symbol.iterator] () {
		yield* this.#controlMap.keys();
	}

	*activeControls () {
		const keys = new Set(this.controlMap.keys());
		for (const event of this.#paused)
			keys.delete(event);
		yield* keys;
	}

	*pausedControls () {
		yield* this.#paused;
	}

	*assoc () {
		yield* this.#controlMap.values();
	}
}

export default AbstractController;
