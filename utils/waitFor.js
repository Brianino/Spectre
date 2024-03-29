import logger from '../core/logger.js';
import _ from 'lodash';

const log = logger('Utilities'),
	{ isFunction } = _;

/**
 * A timeout function to wait for a certain condition
 * @memberof utils
 *
 * @param  {number}   time      - the amount of total time to wait for
 * @param  {number}   interval  - the interval at which to run the check function
 * @param  {function} checkFunc - the function to run to check if the wait has succeeded, should return a truthy value
 * @return {Promise} a promise that resolves when the check function succeeds, otherwise it will reject
*/
function waitFor (time = 1000, interval = 10, checkFunc) {
	if (!checkFunc && isFunction(interval)) {
		checkFunc = interval;
		interval = 10;
	} else {
		interval = Number(interval);
		if (isNaN(interval) || interval === 0)
			interval = 10;
	}
	log.debug('Will wait', time, 'with interval', interval, `(Has check? ${!!checkFunc} ${typeof checkFunc})`);
	return new Promise((resolve, reject) => {
		const func = async (passed) => {
			const timeRemaining = time - passed;
			try {
				if (await checkFunc())
					return resolve(true);
				else if (timeRemaining <= 0)
					return resolve(false);
				else if (timeRemaining < interval)
					interval = timeRemaining;

				setTimeout(func, interval, passed + interval);
			} catch (e) {
				return reject(e);
			}
		};

		if (isFunction(checkFunc)) {
			setImmediate(func, 0);
		} else {
			checkFunc = () => true;
			setTimeout(func, time, time);
		}
	});
}

export default waitFor;
