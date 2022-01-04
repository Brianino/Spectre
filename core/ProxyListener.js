'use strict';

import logger from './logger.js';
import EventEmitter from 'events';

const log = logger('Proxy-Listener');
const sym = {
	source: Symbol('source listener'),
	events: Symbol('events to listeners'),
	checks: Symbol('listeners to check'),
	errors: Symbol('forward errors'),
	queue: Symbol('queue')
}

/** Proxy listener
 *
 * @param {EventEmitter} [source]                - source event emitter
 * @param {boolean}      [errorsFromSource=true] - true if uncaught listener errors should be forwarded to the error event
*/
class ProxyListener {
	constructor (source, errorsFromSource = true) {
		if (source && source instanceof EventEmitter === false)
			throw new Error('Source emitter is not an event emitter');
		Object.defineProperties(this, {
			[sym.source]: {value: source, writable: true},
			[sym.events]: {value: new Map()},
			[sym.checks]: {value: new WeakMap()},
			[sym.errors]: {value: errorsFromSource? true : false},
			[sym.queue]: {value: []},
		});
	}

	/** Attaches an event listener to the source event emitter
	 * @private
	 * @param {string}     event - name of the event to attach a listener to
	 * @param {function[]} lList - set of listener methods that run when the event is called
	*/
	#attachToSource (event, lList) {
		let res;

		log.debug('attaching new event listener to source:', event, lList);
		this[sym.source].on(event, res = async (...params) => {
			for (let temp of lList) {
				let check = this[sym.checks].get(temp);
				try {
					if (!check || await check(...params)) {
						await temp(...params);
					} else {
						log.debug('Skipping listener due to failed check');
					}
				} catch (e) {
					if (this[sym.errors]) this[sym.source].emit('error', e);
					else log.error('Uncaught error in', event, 'listener:', e);
				}
			}
		});
		return res;
	}

	/** Sets the source event emitter if one wasn't set during the instantiation
	 * @param {EventEmitter} input - the source event emitter
	 * @throws will throw an error if the source event emitter is already set
	*/
	set source (input) {
		if (!this[sym.source] && input instanceof EventEmitter) {
			this[sym.source] = input;
			log.debug('Proxy listener source set');
			log.debug(this[sym.queue].length, 'listener queued up for addition');
			this[sym.queue].forEach(func => {
				func();
			});
		} else {
			throw new Error('Source emitter already set');
		}
	}

	/**
	 * @return {boolean} true if a source event emitter is attached
	*/
	get isAttached () {
		return !!this[sym.source];
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
		let [lList] = this[sym.events].get(eventName = (typeof eventName === 'symbol')? eventName : String(eventName)) || [];

		if (!this[sym.source]) {
			log.debug('Source not set up yet, queuing up addition for', eventName);
			this[sym.queue].push(this.on.bind(this, eventName, listener, check));
			return this;
		}
		if (!lList) {
			let temp = this.#attachToSource(eventName, lList = new Set());

			this[sym.events].set(eventName, [lList, temp]);
		}
		if (typeof check === 'function')
			this[sym.checks].set(listener, check);
		lList.add(listener);
		return this;
	}

	/**
	 * @alias listener.on
	*/
	addListener (eventName, listener, check) {return this.on(eventName, listener, check)}

	/** Attaches a one time listener to the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	once (eventName, listener, check) {
		let onceWrapper = (function (eventName, listener, ...params) {
			this.removeListener(eventName, listener);
			listener(...params);
		}).bind(this, eventName, listener);
		onceWrapper.listener = listener;
		return this.on(eventName, onceWrapper, check);
	}

	/** Attaches a listener to the beginning of the listener array in the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	prependListener (eventName, listener, check) {
		let lList, tmp;
		if (!this[sym.source]) {
			log.debug('Source not set up yet, queuing up prepend addition for', eventName);
			this[sym.queue].push(this.prependListener.bind(this, eventName, listener, check));
			return this;
		}
		eventName = (typeof eventName === 'symbol')? eventName : String(eventName)
		this.on(eventName, listener, check);
		[lList] = this[sym.events].get(eventName);
		tmp = [...lList];
		tmp.unshift(tmp.pop());
		lList.clear();
		tmp.forEach(val => lList.add(val));
		return this;
	}

	/** Attaches a one time listener to the beginning of the listener array in the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - listener to run when the specified event on the source emitter occurs
	 * @param {listener-checkCallback} check     - checks if a listener should run
	*/
	prependOnceListener (eventName, listener, check) {
		let onceWrapper = (function (eventName, listener, ...params) {
			this.removeListener(eventName, listener);
			listener(...params);
		}).bind(this, eventName, listener);
		onceWrapper.listener = listener;
		return this.prependListener(eventName, onceWrapper, check);
	}

	/** Removes a listener from the proxy
	 * @param {string|symbol}          eventName - the name of the event to attach the listener to
	 * @param {listener-listener}      listener  - the listener to remove
	*/
	removeListener (eventName, listener) {
		let lList, att;

		if (!this[sym.source]) {
			log.debug('Source not set up yet, queuing up removal of listener for', eventName);
			this[sym.queue].push(this.removeListener.bind(this, eventName, listener));
			return this;
		}
		eventName = (typeof eventName === 'symbol')? eventName : String(eventName);
		[lList, att] = this[sym.events].get(eventName) || [new Set(), () => {}];
		if (!lList.delete(listener)) {
			for (let temp of lList) {
				if (temp.listener === listener) {
					lList.delete(temp);
					break;
				}
			}
		}
		this[sym.checks].delete(listener);
		if (lList.size === 0)  {
			this[sym.source].removeListener(eventName, att);
			this[sym.events].delete(eventName);
		}
		return this;
	}

	/**
	 * @alias listener.removeListener
	*/
	off (eventName, listener) {return this.removeListener(eventName, listener)}

	/** A list of all the event names that currently have listeners attached
	 * @return {Array<string|symbol>}
	*/
	eventNames () {
		return [...this[sym.events].keys()];
	}

	/** A count of the number of listeners attached to a given event
	 * @param {string|symbol} eventName - the name of the event
	 * @return {number} count of attached listeners
	*/
	listenerCount (eventName) {
		let [lList] = this[sym.events].get(eventName = (typeof eventName === 'symbol')? eventName : String(eventName)) || [];

		if (lList) return lList.size;
		else return 0;
	}
}

export { ProxyListener as default };
