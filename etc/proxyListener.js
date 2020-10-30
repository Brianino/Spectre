'use strict';

const log = require('./logger.js')('proxy-listener');
const eventEmitter = require('events');
const sym = {
	source: Symbol('source listener'),
	events: Symbol('events to listeners'),
	checks: Symbol('listeners to check'),
	errors: Symbol('forward errors')
}

function attachToSource (event, lList, {[sym.source]: source, [sym.checks]:checks, [sym.errors]: forwardEv}) {
	let res;

	log.debug('attaching new event listener to source:', event, lList);
	if (checks) {
		source.on(event, res = async (...params) => {
			for (let temp of lList) {
				let check = checks.get(temp);
				try {
					if (!check || await check(...params)) {
						await temp(...params);
					} else {
						log.debug('Skipping listener due to failed check');
					}
				} catch (e) {
					if (forwardEv) source.emit('error', e);
					else log.error('Uncaught error in', eventName, 'listener:', e);
				}
			}
		});
	} else {
		source.on(event, res = async (...params) => {
			for (let temp of lList) {
				try {
					await temp(...params);
				} catch (e) {
					if (forwardEv) source.emit('error', e);
					else log.error('Uncaught error in', eventName, 'listener:', e);
				}
			}
		});
	}
	return res;
}

/*
 * Object to store the basic properties of a module
 *
 * @param {string} name  - the string used by a user to call the module function
 * @param {string} group - the name for the group of commands this module is part of
*/
module.exports = class listener {
	constructor (source, errorsFromSource = true) {
		if (source && !source instanceof eventEmitter)
			throw new Error('Source emitter is not an event emitter');
		Object.defineProperties(this, {
			[sym.source]: {value: source, writable: true},
			[sym.events]: {value: new Map()},
			[sym.checks]: {value: new WeakMap()},
			[sym.errors]: {value: errorsFromSource? true : false},
			[sym.queue]: {value: []},
		});
		// add queue to handle the source being added later;
	}

	set source (input) {
		if (!this[sym.source] && input instanceof eventEmitter) {
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

	get isAttached () {
		return this[sym.source] && true;
	}

	on (eventName, listener, check) {
		let [lList] = this[sym.events].get(eventName = (typeof eventName === 'symbol')? eventName : String(eventName)) || [];

		if (!this[sym.source]) {
			log.debug('Source not set up yet, queuing up addition for', eventName);
			this[sym.queue].push(this.on.bind(this, eventName, listener, check));
			return this;
		}
		if (!lList) {
			let temp = attachToSource(eventName, lList = new Set(), this);

			this[sym.events].set(eventName, [lList, temp]);
		}
		if (check) this[sym.checks].set(listener, (typeof check === 'function')? check : () => check);
		lList.add(listener);
		return this;
	}

	addListener (eventName, listener, check) {return this.on(eventName, listener, check)}

	once (eventName, listener, check) {
		let onceWrapper = (function (eventName, listener) {
			this.removeListener(eventName, listener);
			listener();
		}).bind(this, eventName, listener);
		onceWrapper.listener = listener;
		return this.on(eventName, onceWrapper, check);
	}

	prependListener (eventName, listener, check) {
		let [lList] = this[sym.events].get(eventName = (typeof eventName === 'symbol')? eventName : String(eventName)) || [];

		if (!this[sym.source]) {
			log.debug('Source not set up yet, queuing up prepend addition for', eventName);
			this[sym.queue].push(this.on.bind(this, eventName, listener, check));
			return this;
		}
		if (!lList) {
			let temp = attachToSource(eventName, lList = new Set(), this);

			this[sym.events].set(eventName, [lList, temp]);
			lList.add(listener);
		} else {
			lList = new Set([listener, ...lList])
		}
		if (check) this[sym.checks].set(listener, (typeof check === 'function')? check : () => check);
		return this;
	}

	prependOnceListener (eventName, listener, check) {
		let onceWrapper = (function (eventName, listener) {
			this.removeListener(eventName, listener);
			listener();
		}).bind(this, eventName, listener);
		onceWrapper.listener = listener;
		return this.prependListener(eventName, onceWrapper, check);
	}

	removeListener (eventName, listener) {
		let lList, att;

		if (!this[sym.source]) {
			this[sym.queue].push(this.on.bind(this, eventName, listener));
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
		if (lList.size() === 0)  {
			source.removeListener(eventName, att);
			this[sym.events].delete(eventName);
		}
		return this;
	}

	off (eventName, listener) {return this.removeListener(eventName, listener)}

	eventNames () {
		return [...this[sym.events].keys()];
	}

	listenerCount (eventName) {
		let [lList] = this[sym.events].get(eventName = (typeof eventName === 'symbol')? eventName : String(eventName)) || [];

		if (lList) return lList.size;
		else return 0;
	}
}
