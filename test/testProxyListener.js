const proxyListener = require('../etc/proxyListener.js');
const events = require('events');
const assert = require('assert').strict;

describe('Proxy Listner', function () {
	describe('Initialised with source event emitter', function () {
		let source = new events(), plistener = new proxyListener(source);

		it('can create the proxy listener', function () {
			assert.ok(plistener.isAttached);
			assert.ok(plistener);
		});

		standardTests(plistener, source);
	});

	describe('Source event emitter added later', function () {
		let source = new events(), plistener = new proxyListener(), list = [],
		evQue = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(queue)'),
		evSym = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(events to listeners)');

		it('can create the proxy listener', function () {
			assert.ok(!plistener.isAttached);
			assert.ok(plistener);
		});

		it('can queue up listener addition', function () {
			let listener = () => {}, event = Symbol('Queue listener'), size = plistener[evQue].length;

			plistener.on(event, listener);
			list.push({event, listener});

			assert.ok((size + 1) === plistener[evQue].length);
		});

		it('can queue up once listener addition', function () {
			let listener = () => {}, event = Symbol('Queue once listener'), size = plistener[evQue].length;

			plistener.once(event, listener);
			list.push({event, listener, once: true});

			assert.ok((size + 1) === plistener[evQue].length);
		});

		it('can queue up listener prepend', function () {
			let listener = () => {}, event = Symbol('Queue prepend'), size = plistener[evQue].length,
			listener2 = () => {};

			plistener.on(event, listener2);
			plistener.prependListener(event, listener);
			list.unshift({event, listener, check: (input) => input[0] === listener && input[1] === listener2});

			assert.ok((size + 2) === plistener[evQue].length);
		});

		it('can queue up listener removal', function () {
			let listener = () => {}, event = Symbol('Queue delete'), size = plistener[evQue].length;

			plistener.on(event, listener);
			list.push({event, listener, deleted: true});
			plistener.off(event, listener);

			assert.ok((size + 2) === plistener[evQue].length);
		});

		it('can attach the source emitter', function () {
			plistener.source = source;
			assert.ok(plistener.isAttached);
		});

		it('should have dealt with the queued up actions', function () {
			for (let {event, listener, once, deleted, check} of list) {
				let [tmp] = plistener[evSym].get(event) || [new Set()];

				if (!deleted && once)
					assert.ok([...tmp].find(val => val.listener === listener), event.toString() + ' wasn\'t added');
				else if (!deleted)
					assert.ok(tmp.has(listener), event.toString() + ' wasn\'t added');
				else if (once)
					assert.ok(![...tmp].find(val => val.listener === listener), event.toString() + ' wasn\'t removed');
				else
					assert.ok(!tmp.has(listener), event.toString() + ' wasn\'t removed');

				if (check)
					assert.ok(check([...tmp]), event.toString() + ' failed the check');
			}
		});

		standardTests(plistener, source);
	});

	describe('Uncaught listener error forwarding', function () {
		let source = new events();
		it('should forward uncaught errors to the error event', function () {
			let plistener = new proxyListener(source, true), event = Symbol();

			return new Promise((resolve) => {
				let e = new Error('uncaught error');
				plistener.on('error', (err) => {
					if (err === e)
						return resolve();
				});
				plistener.on(event, () => {throw e});
				source.emit(event);
			});
		});

		it('should catch and log uncaught errors');
	});
});

function standardTests (plistener, source) {
	let testFuncs = [], evSym = Object.getOwnPropertySymbols(plistener).find(sym => sym.toString() === 'Symbol(events to listeners)');

	describe('General', function () {
		it('should only attach a single listener to the source emitter for each event', function () {
			let listener = () => {}, event = 'test';
			plistener.on(event, listener);
			testFuncs.push({event, listener});
			assert.ok(source.listenerCount(event));
		});

		it('can give a count of attached listeners', function () {
			assert.ok(plistener.listenerCount('test'));
		});

		it('Should forward an event successfully to the proxy listener', function () {
			return new Promise ((resolve) => {
				let listener = resolve, event = Symbol('forward event');
				plistener.on(event, listener);
				testFuncs.push({event, listener});
				source.emit(event);
			});
		});
	});

	let count = 0, eventNameGenerator = [() => 'test' + count++, () => Symbol()];
	let methodSets = {
		on: ['on', 'addListener'],
		once:['once'],
		prepend: ['prependListener'],
		prependOnce: ['prependOnceListener'],
		off: ['off', 'removeListener'],
	}

	for (let func of eventNameGenerator) {
		let checkparams = (prop, once) => {
			it('should pass through arguments using ' + prop + ' (promise)', function () {
				let testValue = 'passed value';

				return new Promise ((resolve) => {
					let listener = resolve, event = func();
					plistener[prop](event, listener);
					if (!once)
						testFuncs.push({event, listener, once});
					source.emit(event, testValue);
				}).then(retValue => {
					assert.equal(retValue, testValue);
				});
			});

			it('should pass through mulitple arguments using ' + prop + ' (arrow)', function () {
				let testValue = ['some test value', 'second test'], event = func();

				return new Promise(resolve => {
					let listener = (...input) => resolve(input);

					plistener[prop](event, listener);
					if (!once)
						testFuncs.push({event, listener, once});
					source.emit(event, ...testValue);
				}).then(retValue => {
					assert.deepEqual(retValue, testValue);
				});
			});
		}

		describe('Using ' + typeof func() + ' for event names', function () {
			describe('Adding Listeners', function () {
				for (let prop of methodSets.on) {
					let once = false;
					it('can add a listener using ' + prop + ' with name as ' + typeof func(), function () {
						let listener = () => {}, event = func(), tmp;

						plistener[prop](event, listener);
						testFuncs.push({event, listener, once});
						[tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok(tmp.has(listener));
					});

					it('should run if the check function returns true', function () {
						return new Promise ((resolve) => {
							let listener = resolve, event = func();
							plistener[prop](event, listener, () => true);
							testFuncs.push({event, listener, once});
							source.emit(event);
						});
					});

					it('should not run if the check function returns false', function () {
						return new Promise ((resolve, reject) => {
							let event = func();
							plistener[prop](event, reject, () => false);
							plistener[prop](event, resolve)
							testFuncs.push({event, listener: resolve, once});
							testFuncs.push({event, listener: reject, once});
							source.emit(event);
						});
					});

					checkparams(prop, once);
				}
			});

			describe('Adding one time listeners', function () {
				for (let prop of methodSets.once) {
					let once = true;
					it('can add a one time listener using ' + prop, function () {
						let listener = () => {}, event = func(), tmp;

						plistener[prop](event, listener);
						testFuncs.push({event, listener, once});
						[tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok([...tmp].find(val => val.listener === listener));
					});

					it('should remove the once listener after running once', function () {
						let event = func(), listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							let [tmp] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...tmp].find(val => val.listener === listener));
						});
					});

					checkparams(prop, once);
				}
			});

			describe('Prepending listeners', function () {
				for (let prop of methodSets.prepend) {
					let once = false;
					it('can prepend a listener using ' + prop, function () {
						let listener = () => {}, listener2 = () => {}, event = func(), tmp;

						plistener[prop](event, listener2);
						testFuncs.push({event, listener: listener2, once});

						plistener[prop](event, listener);
						testFuncs.push({event, listener, once});
						[tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok(tmp.has(listener));
						assert.ok(tmp.has(listener2));
						assert.equal(tmp[Symbol.iterator]().next().value, listener);
					});
				}
			});

			describe('Prepending one time listeners', function () {
				for (let prop of methodSets.prependOnce) {
					let once = true;
					it('can prepend a one time listener using ' + prop, function () {
						let listener = () => {}, listener2 = () => {}, event = func(), tmp;

						plistener[prop](event, listener2);
						testFuncs.push({event, listener: listener2, once});

						plistener[prop](event, listener);
						testFuncs.push({event, listener, once});
						[tmp] = plistener[evSym].get(event);

						assert.ok(tmp);
						assert.ok([...tmp].find(val => val.listener === listener));
						assert.ok([...tmp].find(val => val.listener === listener2));
						assert.equal(tmp[Symbol.iterator]().next().value.listener, listener);
					});

					it('should remove the prepended once listener after running once', function () {
						let event = func(), listener;

						return new Promise(resolve => {
							plistener[prop](event, listener = resolve);
							source.emit(event);
						}).then(() => {
							let [tmp] = plistener[evSym].get(event) || [new Set()];

							assert.ok(![...tmp].find(val => val.listener === listener));
						});
					});
				}
			});
		});
	}

	describe('General', function () {
		it('can list off event names with attached listeners', function () {
			let events = new Set(plistener.eventNames());

			for (let {event} of testFuncs) {
				assert.ok(events.has(event));
			}
		});
	})

	describe('Removing listeners', function () {
		for (let prop of methodSets.off) {
			it('can remove a listener using ' + prop, function () {
				let list = testFuncs.filter(({once}) => !once), {event, listener} = list[Symbol.iterator]().next().value, tmp;

				[tmp] = plistener[evSym].get(event);
				plistener[prop](event, listener);

				assert.ok(tmp);
				assert.ok(!tmp.has(listener));
				testFuncs = testFuncs.filter(val => val.listener !== listener);
			});

			it('can remove a once listener using ' + prop, function () {
				let list = testFuncs.filter(({once}) => once), {event, listener} = list[Symbol.iterator]().next().value, tmp;

				[tmp] = plistener[evSym].get(event);
				plistener[prop](event, listener);

				assert.ok(![...tmp].find(val => val.listener === listener));
				testFuncs = testFuncs.filter(val => val.listener !== listener);
			});
		}

		it('can remove all the listeners', function () {
			for (let {event, listener, once} of testFuncs) {
				let [tmp, slistener] = plistener[evSym].get(event) || [];

				assert.ok(tmp, 'missing listeners for ' + event.toString());
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
