"use strict";

import logger from './logger.js';
import { Mutex } from 'async-mutex';
import { setInterval } from 'timers/promises';

const locks = new Map(), log = logger('Named-Lock');
let cleanupRunning = false;

async function autoCleanup () {
	if (!cleanupRunning) {
		cleanupRunning = true
		for await (const ignore of setInterval(5000, cleanupRunning, {ref: false})) {
			for (let [key, lock] of locks) {
				if (!lock.deref()) {
					log.debug('Cleaning up named lock', key);
					locks.delete(key);
				}
			}
			if (!locks.size())
				break;
		}
		cleanupRunning = false;
	}
}

function Lock (key) {
	let lock = locks.get(key);

	if (!lock || !(lock = lock.deref())) {
		lock = new Mutex();
		locks.set(key, new WeakRef(lock));
		autoCleanup().catch(e => log.error('Auto cleanup failed:', e.message));
	}
	return lock;
}

export default Lock;
