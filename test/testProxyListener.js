import ProxyListener from '../core/ProxyListener.js';
import assert from 'assert/strict';
import Events from 'events';

describe('Proxy Listener', function () {
	describe('Initialised with source event emitter', function () {
		const source = new Events(), plistener = new ProxyListener(source);

		it('can create the proxy listener', function () {
			assert.ok(plistener.isAttached);
			assert.ok(plistener);
		});

		standardTests(plistener, source);
	});

	describe('Source event emitter added later', function () {
		const source = new Events(), plistener = new ProxyListener(), list = [],
			evQue = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(queue)'),
			evSym = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(events to listeners)');

		it('can create the proxy listener', function () {
			assert.ok(!plistener.isAttached);
			assert.ok(plistener);
		});

		it('can queue up listener addition', function () {
			const listener = () => {}, event = Symbol('Queue listener'), size = plistener[evQue].length;

			plistener.on(event, listener);
			list.push({ event, listener });

			assert.ok((size + 1) === plistener[evQue].length);
		});

		it('can queue up once listener addition', function () {
			const listener = () => {}, event = Symbol('Queue once listener'), size = plistener[evQue].length;

			plistener.once(event, listener);
			list.push({ event, listener, once: true });

			assert.ok((size + 1) === plistener[evQue].length);
		});

		it('can queue up listener prepend', function () {
			const listener = () => {}, event = Symbol('Queue prepend'), size = plistener[evQue].length,
				listener2 = () => {};

			plistener.on(event, listener2);
			plistener.prependListener(event, listener);
			list.unshift({ event, listener, check: (input) => input[0] === listener && input[1] === listener2 });

			assert.ok((size + 2) === plistener[evQue].length);
		});

		it('can queue up listener removal', function () {
			const listener = () => {}, event = Symbol('Queue delete'), size = plistener[evQue].length;

			plistener.on(event, listener);
			list.push({ event, listener, deleted: true });
			plistener.off(event, listener);

			assert.ok((size + 2) === plistener[evQue].length);
		});

		it('can attach the source emitter', function () {
			plistener.source = source;
			assert.ok(plistener.isAttached);
		});

		it('should have dealt with the queued up actions', function () {
			for (const { event, listener, once, deleted, check } of list) {
				const [tmp] = plistener[evSym].get(event) || [new Set()];

				if (!deleted && once)
					assert.ok([...tmp].find(val => val.listener === listener), `${event.toString()} wasn't added`);
				else if (!deleted)
					assert.ok(tmp.has(listener), `${event.toString()} wasn't added`);
				else if (once)
					assert.ok(![...tmp].find(val => val.listener === listener), `${event.toString()} wasn't removed`);
				else
					assert.ok(!tmp.has(listener), `${event.toString()} wasn't removed`);

				if (check)
					assert.ok(check([...tmp]), `${event.toString()} failed the check`);
			}
		});

		standardTests(plistener, source);
	});

	describe('Uncaught listener error forwarding', function () {
		const source = new Events();
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

		it('should catch and log uncaught errors');
	});
});

function standardTests (plistener, source) {
	const evSym = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(events to listeners)');
	let testFuncs = [];

	describe('General', function () {
		it('should only attach a single listener to the source emitter for each event', function () {
			const listener = () => {}, event = 'test';
			plistener.on(event, listener);
			testFuncs.push({ event, listener });
			assert.ok(source.listenerCount(event));
		});

		it('can give a count of attached listeners', function () {
			assert.ok(plistener.listenerCount('test'));
		});

		it('Should forward an event successfully to the proxy listener', function () {
			return new Promise((resolve) => {
				const listener = resolve, event = Symbol('forward event');
				plistener.on(event, listener);
				testFuncs.push({ event, listener });
				source.emit(event);
			});
		});
	});

	// eslint-disable-next-line one-var
	let count = 0;
	const eventNameGenerator = [() => `test${count++}`, () => Symbol()],
		methodSets = {
			on: ['on', 'addListener'],
			once: ['once'],
			prepend: ['prependListener'],
			prependOnce: ['prependOnceListener'],
			off: ['off', 'removeListener'],
		};

	for (const func of eventNameGenerator) {
		const checkparams = (prop, once) => {
			it(`should pass through arguments using ${prop} (promise)`, function () {
				const testValue = 'passed value';

				return new Promise((resolve) => {
					const listener = resolve, event = func();
					plistener[prop](event, listener);
					if (!once)
						testFuncs.push({ event, listener, once });
					source.emit(event, testValue);
				}).then(retValue => {
					assert.equal(retValue, testValue);
				});
			});

			it(`should pass through mulitple arguments using ${prop} (arrow)`, function () {
				const testValue = ['some test value', 'second test'], event = func();

				return new Promise(resolve => {
					const listener = (...input) => resolve(input);

					plistener[prop](event, listener);
					if (!once)
						testFuncs.push({ event, listener, once });
					source.emit(event, ...testValue);
				}).then(retValue => {
					assert.deepEqual(retValue, testValue);
				});
			});
		};

		describe(`Using ${typeof func()} for event names`, function () {
			describe('Adding Listeners', function () {
				for (const prop of methodSets.on) {
					const once = false;
					it(`can add a listener using ${prop} with name as ${typeof func()}`, function () {
						const listener = () => {}, event = func();

						plistener[prop](event, listener);
						testFuncs.push({ event, listener, once });
						const [tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok(tmp.has(listener));
					});

					it('should run if the check function returns true', function () {
						return new Promise((resolve) => {
							const listener = resolve, event = func();
							plistener[prop](event, listener, () => true);
							testFuncs.push({ event, listener, once });
							source.emit(event);
						});
					});

					it('should not run if the check function returns false', function () {
						return new Promise((resolve, reject) => {
							const event = func();
							plistener[prop](event, reject, () => false);
							plistener[prop](event, resolve);
							testFuncs.push({ event, listener: resolve, once });
							testFuncs.push({ event, listener: reject, once });
							source.emit(event);
						});
					});

					checkparams(prop, once);
				}
			});

			describe('Adding one time listeners', function () {
				for (const prop of methodSets.once) {
					const once = true;
					it(`can add a one time listener using ${prop}`, function () {
						const listener = () => {}, event = func();

						plistener[prop](event, listener);
						testFuncs.push({ event, listener, once });
						const [tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok([...tmp].find(val => val.listener === listener));
					});

					it('should remove the once listener after running once', function () {
						const event = func();
						let listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							const [tmp] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...tmp].find(val => val.listener === listener));
						});
					});

					checkparams(prop, once);
				}
			});

			describe('Prepending listeners', function () {
				for (const prop of methodSets.prepend) {
					const once = false;
					it(`can prepend a listener using ${prop}`, function () {
						const listener = () => {}, listener2 = () => {}, event = func();

						plistener[prop](event, listener2);
						testFuncs.push({ event, listener: listener2, once });

						plistener[prop](event, listener);
						testFuncs.push({ event, listener, once });
						const [tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok(tmp.has(listener));
						assert.ok(tmp.has(listener2));
						assert.equal(tmp[Symbol.iterator]().next().value, listener);
					});
				}
			});

			describe('Prepending one time listeners', function () {
				for (const prop of methodSets.prependOnce) {
					const once = true;
					it(`can prepend a one time listener using ${prop}`, function () {
						const listener = () => {}, listener2 = () => {}, event = func();

						plistener[prop](event, listener2);
						testFuncs.push({ event, listener: listener2, once });

						plistener[prop](event, listener);
						testFuncs.push({ event, listener, once });
						const [tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok([...tmp].find(val => val.listener === listener));
						assert.ok([...tmp].find(val => val.listener === listener2));
						assert.equal(tmp[Symbol.iterator]().next().value.listener, listener);
					});

					it('should remove the prepended once listener after running once', function () {
						const event = func();
						let listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							const [tmp] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...tmp].find(val => val.listener === listener));
						});
					});
				}
			});
		});
	}

	describe('General', function () {
		it('can list off event names with attached listeners', function () {
			const events = new Set(plistener.eventNames());

			for (const { event } of testFuncs)
				assert.ok(events.has(event));

		});
	});

	describe('Removing listeners', function () {
		for (const prop of methodSets.off) {
			it(`can remove a listener using ${prop}`, function () {
				const list = testFuncs.filter(({ once }) => !once), { event, listener } = list[Symbol.iterator]().next().value,
					[tmp] = plistener[evSym].get(event);

				plistener[prop](event, listener);

				assert.ok(tmp);
				assert.ok(!tmp.has(listener));
				testFuncs = testFuncs.filter(val => val.listener !== listener);
			});

			it(`can remove a once listener using ${prop}`, function () {
				const list = testFuncs.filter(({ once }) => once), { event, listener } = list[Symbol.iterator]().next().value,
					[tmp] = plistener[evSym].get(event);

				plistener[prop](event, listener);

				assert.ok(![...tmp].find(val => val.listener === listener));
				testFuncs = testFuncs.filter(val => val.listener !== listener);
			});
		}

		it('can remove all the listeners', function () {
			for (const { event, listener, once } of testFuncs) {
				const [tmp, slistener] = plistener[evSym].get(event) || [];

				assert.ok(tmp, `missing listeners for ${event.toString()}`);
				plistener.off(event, listener);

				if (!once)
					assert.ok(!tmp.has(listener));
				else
					assert.ok(![...tmp].find(val => val.listener === listener));

				testFuncs = testFuncs.filter(val => val.listener !== listener);

				if (!plistener.listenerCount(event)) {
					assert.ok(!plistener[evSym].get(event));
					assert.ok(!source.listeners(event).find(val => val === slistener));
				}
			}
		});
	});
}
