'use strict';

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
	interval =  Number(interval);
	if (isNaN(interval) || interval === 0) interval = 10;
	return new Promise((resolve, reject) => {
		let func = async (passed, tFunc) => {
			let newTime = interval + passed - time;
			try {
				if (await tFunc()) {
					return resolve(true);
				} else if (newTime > 0) {
					interval -= newTime;
					if (interval <= 0) return resolve(false);
				}
				setTimeout(func, interval, passed + interval, tFunc);
			} catch (e) {
				return reject(e);
			}
		}
		if (interval && typeof checkFunc === 'function')
			setTimeout(func, interval, interval, checkFunc);
		else
			setTimeout(func, time, time, () => true);
	})
}

export default waitFor;
