import ProxyListener from '../core/ProxyListener.js';
import { logAppender } from '../core/logger.js';
import assert from 'assert/strict';
import Events from 'events';

describe('Proxy Listener', function () {
	let source, plistener, evQue, evSym;

	describe('Initialised with source event emitter', function () {

		beforeEach(function () {
			source = new Events();
			plistener = new ProxyListener(source);
			evQue = Object.getOwnPropertySymbols(plistener)
				.find(sym => sym.toString() === 'Symbol(queue)');
			evSym = Object.getOwnPropertySymbols(plistener)
				.find(sym => sym.toString() === 'Symbol(events to listeners)');
		});

		it('can create the proxy listener', function () {
			assert.ok(plistener.isAttached);
			assert.ok(plistener);
		});

		describe('General', function () {
			standardTests();
		});
	});

	describe('Source event emitter added later', function () {

		beforeEach(function () {
			source = new Events();
			plistener = new ProxyListener();
			evQue = Object.getOwnPropertySymbols(plistener)
				.find(sym => sym.toString() === 'Symbol(queue)');
			evSym = Object.getOwnPropertySymbols(plistener)
				.find(sym => sym.toString() === 'Symbol(events to listeners)');
		});

		it('can create the proxy listener', function () {
			assert.ok(!plistener.isAttached);
			assert.ok(plistener);
		});

		it('can queue up listener addition', function () {
			const listener = () => {}, event = Symbol('Queue listener');

			plistener.on(event, listener);

			assert.equal(plistener[evQue].length, 1);
		});

		it('can queue up once listener addition', function () {
			const listener = () => {}, event = Symbol('Queue once listener');

			plistener.once(event, listener);

			assert.equal(plistener[evQue].length, 1);
		});

		it('can queue up listener prepend', function () {
			const listener = () => {}, event = Symbol('Queue prepend'),
				listener2 = () => {};

			plistener.on(event, listener2);
			plistener.prependListener(event, listener);

			assert.equal(plistener[evQue].length, 2);
		});

		it('can queue up listener removal', function () {
			const listener = () => {}, event = Symbol('Queue delete');

			plistener.on(event, listener);
			plistener.off(event, listener);

			assert.equal(plistener[evQue].length, 2);
		});

		it('can attach the source emitter', function () {
			plistener.source = source;
			assert.ok(plistener.isAttached);
		});

		it('should have dealt with the queued up actions', function () {
			const actions = ['on', 'once', 'prependListener'],
				events = [];

			for (const method of actions) {
				const listener = () => {}, event = Symbol(`Queued Up Action ${method}`);

				plistener[method](event, listener);
				events.push([event, listener, method]);
			}

			plistener.source = source;

			assert.equal(plistener[evSym].size, events.length);

			for (const [event, listener, method] of events) {
				const [attachedListeners] = plistener[evSym].get(event);
				if (method !== 'once')
					assert.ok(attachedListeners.has(listener), `${event.toString()} wasn't added`);
				else
					assert.ok([...attachedListeners].find(it => it.listener === listener), `${event.toString()} wasn't added`);
			}
		});

		describe('General', function () {

			beforeEach(function () {
				plistener.source = source;
			});

			standardTests();
		});
	});


	function standardTests () {

		it('should only attach a single listener to the source emitter for each event', function () {
			const listener = () => {}, event = 'test';
			plistener.on(event, listener);

			assert.ok(source.listenerCount(event));
		});

		for (const count of [1, 2, 10]) {
			it(`can give a count of attached listeners (${count})`, function () {
				for (let i = 0; i < count; i++)
					plistener.on('test', () => {});
				assert.equal(plistener.listenerCount('test'), count);
			});
		}

		it('Should forward an event successfully to the proxy listener', function () {
			return new Promise((resolve) => {
				const listener = resolve, event = Symbol('forward event');
				plistener.on(event, listener);
				source.emit(event);
			});
		});

		// eslint-disable-next-line one-var
		// let count = 0;
		// const eventNameGenerator = [() => `test${count++}`, () => Symbol()],
		// 	methodSets = {
		// 		on: ['on', 'addListener'],
		// 		once: ['once'],
		// 		prepend: ['prependListener'],
		// 		prependOnce: ['prependOnceListener'],
		// 		off: ['off', 'removeListener'],
		// 	};

		eventTests(getName(), 'string');

		eventTests(getSymbol(), 'symbol');

		function eventTests (eventGen, eventType) {
			const checkparams = (prop) => {
				it(`should pass through arguments using ${prop} (promise)`, function () {
					const testValue = 'passed value';

					return new Promise((resolve) => {
						const listener = resolve, event = eventGen.next().value;
						plistener[prop](event, listener);
						source.emit(event, testValue);
					}).then(retValue => {
						assert.equal(retValue, testValue);
					});
				});

				it(`should pass through mulitple arguments using ${prop} (arrow)`, function () {
					const testValue = ['some test value', 'second test'], event = eventGen.next().value;

					return new Promise(resolve => {
						const listener = (...input) => resolve(input);

						plistener[prop](event, listener);
						source.emit(event, ...testValue);
					}).then(retValue => {
						assert.deepEqual(retValue, testValue);
					});
				});
			};

			describe(`Using ${eventType} for event names`, function () {
				describe('Adding Listeners', function () {
					for (const prop of ['on', 'addListener']) {
						const once = false;
						it(`can add a listener using ${prop}`, function () {
							const listener = () => {}, event = eventGen.next().value;

							plistener[prop](event, listener);
							const [listenerCollection] = plistener[evSym].get(event);

							assert.ok(listenerCollection);
							assert.ok(listenerCollection.has(listener));
						});

						it('should run if the check function returns true', function () {
							return new Promise((resolve) => {
								const listener = resolve, event = eventGen.next().value;
								plistener[prop](event, listener, () => true);
								source.emit(event);
							});
						});

						it('should not run if the check function returns false', function () {
							return new Promise((resolve, reject) => {
								const event = eventGen.next().value;
								plistener[prop](event, reject, () => false);
								plistener[prop](event, resolve);
								source.emit(event);
							});
						});

						checkparams(prop, once);
					}
				});

				describe('Adding one time listeners', function () {
					const prop = 'once';
					it(`can add a one time listener using ${prop}`, function () {
						const listener = () => {}, event = eventGen.next().value;

						plistener[prop](event, listener);
						const [listenersForEvent] = plistener[evSym].get(event);

						assert.ok(listenersForEvent);
						assert.ok([...listenersForEvent].find(val => val.listener === listener));
					});

					it('should remove the once listener after running once', function () {
						const event = eventGen.next().value;
						let listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							const [listenersForEvent] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...listenersForEvent].find(val => val.listener === listener));
						});
					});

					checkparams(prop);
				});

				describe('Prepending listeners', function () {
					const prop = 'prependListener';

					it(`can prepend a listener using ${prop}`, function () {
						const listener = () => {}, listener2 = () => {}, event = eventGen.next().value;

						plistener[prop](event, listener2);

						plistener[prop](event, listener);
						const [listenersForEvent] = plistener[evSym].get(event);

						assert.ok(listenersForEvent);
						assert.ok(listenersForEvent.has(listener));
						assert.ok(listenersForEvent.has(listener2));
						assert.equal(listenersForEvent[Symbol.iterator]().next().value, listener);
					});
				});

				describe('Prepending one time listeners', function () {
					const prop = 'prependOnceListener';

					it(`can prepend a one time listener using ${prop}`, function () {
						const listener = () => {}, listener2 = () => {}, event = eventGen.next().value;

						plistener[prop](event, listener2);

						plistener[prop](event, listener);
						const [listenersForEvent] = plistener[evSym].get(event);

						assert.ok(listenersForEvent);
						assert.ok([...listenersForEvent].find(val => val.listener === listener));
						assert.ok([...listenersForEvent].find(val => val.listener === listener2));
						assert.equal(listenersForEvent[Symbol.iterator]().next().value.listener, listener);
					});

					it('should remove the prepended once listener after running once', function () {
						const event = eventGen.next().value;
						let listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							const [listenersForEvent] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...listenersForEvent].find(val => val.listener === listener));
						});
					});
				});
			});

			it('can list off event names with attached listeners', function () {
				const methods = ['on', 'addListener', 'once', 'prependListener', 'prependOnceListener'],
					events = [];

				for (const method of methods) {
					const evName = eventGen.next().value;

					events.push(evName);
					plistener[method](evName, () => {});
				}

				assert.deepEqual(plistener.eventNames(), events);
			});

			describe('Removing listeners', function () {
				for (const prop of ['off', 'removeListener']) {
					it(`can remove a listener using ${prop}`, function () {
						const listener = () => {}, event = eventGen.next().value;

						plistener.on(event, listener);
						plistener.on(event, () => {});
						const [listenersForEvent] = plistener[evSym].get(event);

						plistener[prop](event, listener);

						assert.ok(!listenersForEvent.has(listener));
					});

					it(`can remove a once listener using ${prop}`, function () {
						const listener = () => {}, event = eventGen.next().value;

						plistener.once(event, listener);
						plistener.once(event, () => {});
						const [listenersForEvent] = plistener[evSym].get(event);

						plistener[prop](event, listener);

						assert.ok(![...listenersForEvent].find(it => it.listener === listener));
					});
				}

				it('can remove all the listeners', function () {
					const listeners = [], event = eventGen.next().value;

					for (const method of ['on', 'once', 'prependListener', 'prependOnceListener']) {
						const listener = () => {};

						plistener.on(event, listener);
						listeners.push(listener);
					}

					const [listenersForEvent, sourceListener] = plistener[evSym].get(event);

					assert.equal(listenersForEvent.size, 4, 'Not all the listeners were added successfully');

					for (const listener of listeners)
						plistener.off(event, listener);

					assert.equal(listenersForEvent.size, 0, 'Unable to remove all the listeners');
					assert.ok(!source.listeners(event).includes(sourceListener), 'event was not detached from source');
				});
			});
		}
	}


	describe('Uncaught listener error forwarding', function () {
		let source;

		beforeEach(function () {
			source = new Events();
		});

		it('should forward uncaught errors to the error event', function () {
			const plistener = new ProxyListener(source, true), event = Symbol();

			return new Promise((resolve, reject) => {
				const e = new Error('uncaught error');
				plistener.on('error', (err) => {
					if (err === e)
						return resolve();
					else
						return reject(err);
				});
				plistener.on(event, () => { throw e; });
				source.emit(event);
			});
		});

		it('should log forwarded errors to the error event (when there is no error listener attached)', function () {
			const plistener = new ProxyListener(source, true),
				event = Symbol(),
				logs = logAppender.listen('Proxy-Listener', true),
				e = new Error('uncaught error');

			return new Promise((resolve) => {
				plistener.on(event, () => { throw e; });
				source.emit(event);
				resolve();
			}).then(() => {
				const errors = logs.filter(lEvent => lEvent.level.levelStr === 'ERROR');

				assert.equal(errors.length, 1);
				assert.deepEqual(errors[0].data, ['Uncaught error in', event, 'listener:', e]);
			});
		});

		it('should catch and log uncaught errors', function () {
			const plistener = new ProxyListener(source, false),
				event = Symbol('Test error event'),
				logs = logAppender.listen('Proxy-Listener', true),
				e = new Error('uncaught error');

			return new Promise((resolve) => {
				plistener.on(event, () => { throw e; });
				source.emit(event);
				resolve();
			}).then(() => {
				const errors = logs.filter(lEvent => lEvent.level.levelStr === 'ERROR');

				assert.equal(errors.length, 1);
				assert.deepEqual(errors[0].data, ['Uncaught error in', event, 'listener:', e]);
			});
		});
	});
});

function *getName () {
	let count = 0;

	while (true)
		yield `test${count++}`;
}

function *getSymbol () {
	let count = 0;

	while (true)
		yield Symbol(`test${count++}`);
}
