import ConsolidatedListener from '../core/ConsolidatedListener.js';
import assert from 'assert/strict';
import EventEmitter from 'events';

let listener, events = new Set();

class TestError extends Error {};

function Tests () {
	describe('Manage Sources', function () {
		it('Can add a source', function () {
			let source = new EventEmitter(), found = false;
			listener.addSource(source);
			for (let src of listener.sources())
				found ||= (src === source);
			assert.ok([...listener.sources()].length);
			assert.ok(found, 'Source not found when iterating through sources');
		});

		it('Can remove a source', function () {
			let source = new EventEmitter(), found = false;
			listener.addSource(source);
			listener.removeSource(source);
			for (let src of listener.sources())
				found ||= (src === source);
			assert.ok(!found, 'Source found when iterating through sources when it shouldn\'t be');
		});

		it('Can check for source presence', function () {
			let source = new EventEmitter();
			listener.addSource(source);
			assert.ok(listener.hasSource(source), 'Returned false when checking for source presence');
			listener.removeSource(source);
			assert.ok(!listener.hasSource(source), 'Returned true when checking for source presence (and it was removed)');
		});

		it('Can iterate through sources', function () {
			let sources = new Set(), itt;
			sources.add(new EventEmitter());
			sources.add(new EventEmitter());
			for (let source of sources)
				listener.addSource(source);
			itt = sources.values();
			for (let source of listener.sources())
				assert.equal(source, itt.next().value);
		});
	});

	describe('Manage Listeners', function() {
		beforeEach(function () {
			for (let event of events)
				listener.addSource(event);
		});

		for (let prop of ['on', 'addListener']) {
			it(`Can add a listener using ${prop}`, function () {
				let event = Symbol('Test Add'), promises = [];

				listener[prop](event, (resolve) => resolve());
				for (let emitter of events) {
					promises.push(new Promise((resolve) => {
						emitter.emit(event, resolve);
					}));
				}
				return Promise.all(promises);
			});
		}

		for (let prop of ['off', 'removeListener']) {
			it(`Can remove a listener using ${prop}`, function () {
				let event = Symbol('Test Remove'), promises = [];
				listener.on('end', (resolve) => resolve());
				listener[prop](event, (reject) => reject());
				for (let emitter of events) {
					promises.push(new Promise((resolve, reject) => {
						emitter.emit(event, reject);
						setImmediate(() => emitter.emit('end', resolve));
					}));
				}
				return Promise.all(promises);
			});
		}

		it('Can add a one use listener', function () {
			let event = Symbol('Test Once'), promises = [], count = 0;

			listener.once(event, () => count++);
			for (let emitter of events)
				emitter.emit(event);
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					if (count === 1)
						return resolve();
					else
						return reject();
				}, 10);
			});
		});

		it('Can prepend a listener', function () {
			let event = Symbol('Test Prepend'), promises = [];
			listener.on(event, (resolve, reject) => reject());
			listener.prependListener(event, (resolve, reject) => resolve());
			for (let emitter of events) {
				promises.push(new Promise((resolve, reject) => {
					emitter.emit(event, resolve, reject);
				}));
			}
			return Promise.all(promises);
		});

		it('Can prepend a once listener', function () {
			let event = Symbol('Test Prepend Once'), promises = [], count = 0;

			return new Promise((resolve, reject) => {
				listener.on(event, () => (count === 0) && reject());
				listener.prependOnceListener(event, () => count++);
				for (let emitter of events)
					emitter.emit(event);
				setTimeout(() => {
					if (count === 1)
						return resolve();
					else
						return reject();
				}, 10);
			});
		});
	});

	describe('Other', function () {
		beforeEach(function () {
			for (let event of events)
				listener.addSource(event);
		});

		it('Can iterate through attached events');

		it('Can get the listener count');

		it('Can forward uncaught errors to the error event', function () {
			let event = Symbol('Test error event'), promises = [], count = 0;
			return new Promise((resolve, reject) => {
				listener.on(event, () => {throw new TestError()});
				listener.on('error', (e) => {
					if (e instanceof TestError)
						return ++count;
					reject();
				});
				for (let emitter of events)
					emitter.emit(event);
				setTimeout(() => {
					if (count === events.size)
						resolve();
					reject();
				}, 10);
			});
		});

		it('Can log uncaught errors if there is no attached error listener');
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

		Tests();
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

		Tests();
	});
});
