import ConsolidatedListener from '../core/ConsolidatedListener.js';
import { logAppender } from '../core/logger.js';
import assert from 'assert/strict';
import EventEmitter from 'events';

const events = new Set();
let listener;

class TestError extends Error {}

function tests () {
	describe('Manage Sources', function () {
		it('Can add a source', function () {
			const source = new EventEmitter();
			let found = false;

			listener.addSource(source);
			for (const src of listener.sources())
				found ||= (src === source);
			assert.ok([...listener.sources()].length);
			assert.ok(found, 'Source not found when iterating through sources');
		});

		it('Can remove a source', function () {
			const source = new EventEmitter();
			let found = false;

			listener.addSource(source);
			listener.removeSource(source);
			for (const src of listener.sources())
				found ||= (src === source);
			assert.ok(!found, 'Source found when iterating through sources when it shouldn\'t be');
		});

		it('Can check for source presence', function () {
			const source = new EventEmitter();
			listener.addSource(source);
			assert.ok(listener.hasSource(source), 'Returned false when checking for source presence');
			listener.removeSource(source);
			assert.ok(!listener.hasSource(source), 'Returned true when checking for source presence (and it was removed)');
		});

		it('Can iterate through sources', function () {
			const sources = new Set();

			sources.add(new EventEmitter());
			sources.add(new EventEmitter());
			for (const source of sources)
				listener.addSource(source);
			const itt = sources.values();
			for (const source of listener.sources())
				assert.equal(source, itt.next().value);
		});
	});

	describe('Manage Listeners', function () {
		beforeEach(function () {
			for (const event of events)
				listener.addSource(event);
		});

		for (const prop of ['on', 'addListener']) {
			it(`Can add a listener using ${prop}`, function () {
				const event = Symbol('Test Add'), promises = [];

				listener[prop](event, (resolve) => resolve());
				for (const emitter of events) {
					promises.push(new Promise((resolve) => {
						emitter.emit(event, resolve);
					}));
				}
				return Promise.all(promises);
			});
		}

		for (const prop of ['off', 'removeListener']) {
			it(`Can remove a listener using ${prop}`, function () {
				const event = Symbol('Test Remove'), promises = [];
				listener.on('end', (resolve) => resolve());
				listener[prop](event, (reject) => reject());
				for (const emitter of events) {
					promises.push(new Promise((resolve, reject) => {
						emitter.emit(event, reject);
						setImmediate(() => emitter.emit('end', resolve));
					}));
				}
				return Promise.all(promises);
			});
		}

		it('Can add a one use listener', function () {
			const event = Symbol('Test Once');
			let count = 0;

			listener.once(event, () => count++);
			for (const emitter of events)
				emitter.emit(event);
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					if (count === 1)
						return resolve();
					else
						return reject(new Error('Count is not 1'));
				}, 10);
			});
		});

		it('Can prepend a listener', function () {
			const event = Symbol('Test Prepend'), promises = [];
			listener.on(event, (resolve, reject) => reject());
			listener.prependListener(event, (resolve) => resolve());
			for (const emitter of events) {
				promises.push(new Promise((resolve, reject) => {
					emitter.emit(event, resolve, reject);
				}));
			}
			return Promise.all(promises);
		});

		it('Can prepend a once listener', function () {
			const event = Symbol('Test Prepend Once');
			let count = 0;

			return new Promise((resolve, reject) => {
				listener.on(event, () => (count === 0) && reject(new Error('Count is 0')));
				listener.prependOnceListener(event, () => count++);
				for (const emitter of events)
					emitter.emit(event);
				setTimeout(() => {
					if (count === 1)
						return resolve();
					else
						return reject(new Error('Count is not 1'));
				}, 10);
			});
		});
	});

	describe('Other', function () {
		beforeEach(function () {
			for (const event of events)
				listener.addSource(event);
		});

		it('Can iterate through the names of attached events', function () {
			const evNames = new Set(['Test1', 'Test2', 'Test3']);
			for (const evName of evNames)
				listener.on(evName, () => {});


			const itt = evNames.values();
			for (const evName of listener.eventNames())
				assert.equal(evName, itt.next().value);

		});

		it('Can get the listener count', function () {
			const evNames = new Map([['Test1', 3], ['Test2', 2], ['Test3', 1]]);
			let totalCount = 0;

			for (const [evName, count] of evNames) {
				for (let i = 0; i < count; i++)
					listener.on(evName, () => {});

				totalCount += count;
			}

			for (const [evName, count] of evNames)
				assert.equal(listener.listenerCount(evName), count);

			assert.equal(listener.listenerCount(), totalCount);
		});

		it('Can forward uncaught errors to the error event', function () {
			const event = Symbol('Test error event');
			let count = 0;

			return new Promise((resolve, reject) => {
				listener.on(event, () => { throw new TestError(); });
				listener.on('error', (e) => {
					if (e instanceof TestError)
						return ++count;
					reject(e);
				});
				for (const emitter of events)
					emitter.emit(event);
				setTimeout(() => {
					if (count === events.size)
						return resolve();
					reject(new Error('count doesn\'t match the number of events'));
				}, 10);
			});
		});

		it('Can log uncaught errors if there is no attached error listener', function () {
			const logs = logAppender.listen('Consolidated-Listener', true),
				event = Symbol('Test error event');

			listener.on(event, () => { throw new TestError(); });
			return new Promise((resolve) => {

				for (const emitter of events)
					emitter.emit(event);
				setTimeout(() => {
					resolve();
				}, 10);
			}).then(() => {
				const errors = logs.filter(lEvent => lEvent.level.levelStr === 'ERROR');

				assert.equal(errors.length, events.size);
				for (const lEvent of errors) {
					assert.equal(lEvent.data[0], 'Uncaught error:');
					assert.ok(lEvent.data[1] instanceof TestError);
				}
			});
		});
	});
}

describe('Consolidated Listener', function () {
	describe('Single Source', function () {
		beforeEach(function () {
			listener = new ConsolidatedListener();
			events.add(new EventEmitter());
		});

		afterEach(function () {
			listener = null;
			events.clear();
		});

		tests();
	});

	describe('Multi Source', function () {
		beforeEach(function () {
			listener = new ConsolidatedListener();
			events.add(new EventEmitter());
			events.add(new EventEmitter());
			events.add(new EventEmitter());
		});

		afterEach(function () {
			listener = null;
			events.clear();
		});

		tests();
	});
});
