import logger from './logger.js';
import EventEmitter from 'events';
const log = logger('Consolidated-Listener');

/** Consolidated listener
 * Consolidates multiple Event emitters into a single listener
*/
class ConsolidatedListener {
	#sources = new Set();
	#eventsToListeners = new Map();
	#eventsToInternalListener = new Map();

	async #forwardEvent (event, ...params) {
		const list = this.#eventsToListeners.get(event) || [];
		for (const { listener, check } of list) {
			if (!check || await check(...params))
				await listener(...params);
			else
				log.debug('Skipping listener due to failed check');
		}
	}

	#getEventHandler (event) {
		let res = this.#eventsToInternalListener.get(event);

		if (!res) {
			res = (async (...params) => {
				try {
					log.debug('Passing parameters', ...params);
					await this.#forwardEvent(event, ...params);
				} catch (e) {
					if (this.#eventsToListeners.has('error'))
						this.#forwardEvent('error', e).catch(e2 => log.error('Error forwarding error', e, 'because', e2));
					else
						log.error('Uncaught error:', e);
				}
			});
			res.removeFrom = (source) => {
				source.off(event, res);
				if (!this.#sources.size())
					this.#eventsToInternalListener.delete(event);
			};
			res.remove = () => {
				for (const source of this.#sources)
					source.off(event, res);
				this.#eventsToInternalListener.delete(event);
			};
			this.#eventsToInternalListener.set(event, res);
		}
		return res;
	}

	/** Sets up an event emitter with all the proxy listeners to forward events
	 * @private
	 * @param {EventEmitter} source - new event emitter to set up
	*/
	#setupSource (source) {
		if (this.#sources.has(source))
			return false;
		log.debug('Setup new source:', source.constructor.name);
		for (const event of this.#eventsToListeners.keys())
			source.on(event, this.#getEventHandler(event));
		this.#sources.add(source);
		return true;
	}

	/** Attaches a new proxy listener for the specified event to all the emitter sources
	 * @private
	 * @param {string|symbol} event - new event to set up
	*/
	#setupEvent (event) {
		if (this.#eventsToListeners.has(event))
			return false;
		log.debug(`Attaching new event "${String(event)}" to sources`);
		for (const source of this.#sources)
			source.on(event, this.#getEventHandler(event));
		return true;
	}

	/** Adds a source event emitter
	 * @param {EventEmitter} input - the source event emitter
	 * @throws will throw an error if the source event emitter is already set
	*/
	addSource (input) {
		if (input instanceof EventEmitter) {
			this.#setupSource(input) ?
				log.debug('Added source emitter') :
				log.debug('Emitter already added');
			return this;
		} else {
			throw new Error('Source is not an event emitter');
		}
	}

	/** Removes a source event emitter
	 * @param {EventEmitter} input - the source event emitter
	 * @throws will throw an error if the source event emitter is already set
	*/
	removeSource (input) {
		if (!this.#sources.has(input))
			return this;
		for (const event of this.#eventsToListeners.keys())
			this.#getEventHandler(event).removeFrom(input);
		this.#sources.delete(input);
		return this;
	}

	/** Check for the presence of a source EventEmitter
	 * @param {EventEmitter} input - the source
	 * @return {boolean} true if a source event emitter is attached
	*/
	hasSource (input) {
		return this.#sources.has(input);
	}

	/**
	 * Iterate through all the attached sources
	 * @yields {EventEmitter}
	*/
	*sources () {
		yield* this.#sources;
	}

	/**
	 * @callback listener-listener
	 * @param {...*} args - args supplied by the event
	*/

	/**
	 * @callback listener-checkCallback
	 * @param {...*} args - args supplied by the event
	 * @return {boolean} truthy value if the listener should run
	*/

	/** Attaches a listener to the proxy
	 * @param {string}                 eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	on (eventName, listener, check) {
		eventName = (typeof eventName === 'symbol') ? eventName : String(eventName);
		if (this.#setupEvent(eventName))
			this.#eventsToListeners.set(eventName, [{ listener, check }]);
		else
			this.#eventsToListeners.get(eventName).push({ listener, check });
		return this;
	}

	/**
	 * @alias ConsolidatedListener.on
	*/
	addListener (eventName, listener, check) { return this.on(eventName, listener, check); }

	#getOnceWrapper (eventName, listener) {
		const onceWrapper = (function onceWrapper (eventName, listener, ...params) {
			this.removeListener(eventName, listener);
			listener(...params);
		}).bind(this, eventName, listener);
		onceWrapper.listener = listener;
		return onceWrapper;
	}

	/** Attaches a one time listener to the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	once (eventName, listener, check) {
		const onceWrapper = this.#getOnceWrapper(eventName, listener);
		return this.on(eventName, onceWrapper, check);
	}

	/** Attaches a listener to the beginning of the listener array in the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	prependListener (eventName, listener, check) {
		eventName = (typeof eventName === 'symbol') ? eventName : String(eventName);
		this.on(eventName, listener, check);
		const list = this.#eventsToListeners.get(eventName);
		list.unshift(list.pop());
		return this;
	}

	/** Attaches a one time listener to the beginning of the listener array in the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	prependOnceListener (eventName, listener, check) {
		const onceWrapper = this.#getOnceWrapper(eventName, listener);
		return this.prependListener(eventName, onceWrapper, check);
	}

	/** Removes a listener from the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - the listener to remove
	*/
	removeListener (eventName, listener) {
		let list;
		eventName = (typeof eventName === 'symbol') ? eventName : String(eventName);
		list = this.#eventsToListeners.get(eventName) || [];
		list = list.filter(({ listener: li }) => li !== listener);
		if (list.size)
			this.#eventsToListeners.set(eventName, list);
		else if (this.#eventsToListeners.delete(eventName))
			this.#getEventHandler(eventName).remove();
		return this;
	}

	/**
	 * @alias ConsolidatedListener.removeListener
	*/
	off (eventName, listener) { return this.removeListener(eventName, listener); }

	/** Get the event names
	 * @yields {string|symbol}
	*/
	*eventNames () {
		yield* this.#eventsToListeners.keys();
	}

	/** A count of the number of listeners attached
	 * @param {string|symbol} eventName - the name of the event to check the count for, if undefined the total listener count is provided
	 * @return {number} count of attached listeners
	*/
	listenerCount (eventName) {
		if (eventName) {
			eventName = (typeof eventName === 'symbol') ? eventName : String(eventName);
			return (this.#eventsToListeners.get(eventName) || []).length;
		} else {
			let count = 0;
			for (const list of this.#eventsToListeners.values())
				count += list.length;
			return count;
		}
	}
}

export { ConsolidatedListener as default };
