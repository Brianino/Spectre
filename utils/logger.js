'use strict';

const {createWriteStream, mkdirSync, promises:fs, constants} = require('fs');
const supportsColor = require('supports-color');
const debug_logger = require('debug');
const Path = require('path');

if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';

module.exports = (function () {
	const conMap = new Map(), logDir = Path.resolve(__dirname, '../log'), wMap = new WeakMap();
		maxSize = 1024 * 1024 * 512, selfLog = debug_logger('logger:error'); //max size of log files before rolling them up in bytes
	mkdirSync(logDir, {recursive: true});
	setInterval(cleanUp, 1000 * 60 * 60).unref();
	selfLog.color = 160;

	// Set default log level here (when the debug level isn't set)
	return (namespace) => {
		let log = debug_logger(namespace), fileLogger = debug_logger(namespace), debug = log;

		// The default log and info log are redirected to stdout
		debug.log = console.log.bind(console);
		debug.info = log.extend('info');
		debug.info.log = console.log.bind(console);
		if (supportsColor.stdout && supportsColor.stdout.level > 1) {
			debug.color = 247;
			debug.info.color = 40;
		} else if (supportsColor.stdout) {
			debug.color = 8;
			debug.info.color = 10;
		}

		// The rest will continue to output on stderr
		debug.warn = log.extend('warn');
		debug.error = log.extend('error');
		debug.trace = log.extend('trace');
		debug.debug = log.extend('debug');
		if (supportsColor.stderr && supportsColor.stderr.level > 1) {
			debug.warn.color = 226;
			debug.error.color = 160;
			debug.trace.color = 51;
			debug.debug.color = 27;
		} else if (supportsColor.stderr) {
			debug.warn.color =  11;
			debug.error.color = 9;
			debug.trace.color = 14;
			debug.debug.color = 12;
		}

		/*Proxy assigned to the file prop
			Any props of the file prop will direct the output to a log file of that name
			If no prop is provided, then it will log to the 'main.log' file
			No log levels when logging to file, only name spaces
		*/
		fileLogger.useColors = false;
		debug.file = new Proxy(fileLogger, {
			// Redirect the logging to the file with the name of the prop called
			get: (target, prop, receiver) => {
				if (prop in target) Reflect.get(target, prop, receiver);
				else {
					let con = conMap.get(prop);
					if (!con) {
						let str = createWriteStream(Path.resolve(logDir, prop + '.log'), {flags: 'a'});

						con = new console.Console({stdout: str});
						str.on('error', e => {
							conMap.delete(prop);
							selfLog('There was an error logging to file', prop);
							selfLog(e.message);
						});
						conMap.set(prop, con);
						wMap.set(con, str);
					}
					target.log = con.log.bind(con);
					return target;
				}
			},
			// Direct default file loging to main.log
			apply: (target, thisArg, args) => {
				let defaultLog = 'main', con = conMap.get(defaultLog);
				if (!con) {
					let str = createWriteStream(Path.resolve(logDir, defaultLog + '.log'), {flags: 'a'});

					con = new console.Console({stdout: str});
					str.on('error', e => {
						conMap.delete(defaultLog);
						selfLog('There was an error logging to file', defaultLog);
						selfLog(e.message);
					});
					conMap.set(defaultLog, con);
					wMap.set(con, str);
				}
				target.log = con.log.bind(con);
				return Reflect.apply(target, thisArg, args);
			}
		});

		return debug;
	}

	// Move the file into a folder of the same date, and shift any existing files in there up a number
	async function shift (file, _date) {
		let date = _date || new Date().toISOString().split('T')[0], fileName,
			num = Number(file.split('.').slice(-1)[0]), temp, tDir, alt = 0;

		if (isNaN(num)) {
			fileName = Path.basename(file) + '.1';
		} else {
			fileName = Path.basename(file, `.${num}`) + `.${num + 1}`;
		}
		tDir = Path.resolve(logDir, date);
		temp = Path.resolve(tDir, fileName);
		try {
			await fs.access(tDir, constants.F_OK);
			alt++;
			await fs.access(temp, constants.F_OK);
			alt++;
			await shift(temp, date);
		} catch (ignore) {
			if (!alt) {
				await fs.mkdir(tDir);
			} else if (alt > 1) {
				throw ignore;
			}
		}
		selfLog.debug('moving', file, 'to', temp, 'tDir:', tDir);
		await fs.rename(file, temp, temp);
		return date;
	}

	// Check log files, if any of them are bigger or equal to the max size, then roll up the logs
	async function cleanUp () {
		try {
			for await (let item of await fs.opendir(logDir)) {
				if (item.isFile() && String(item.name).endsWith('.log')) {
					let filePath = Path.resolve(logDir, item.name), stats = await fs.stat(filePath);

					if (stats.size >= maxSize) { r
						try {
							let oldCon = conMap.get(Path.basename(filePath, '.log')), oldStr, date;

							oldStr = wMap.get(oldCon);
							date = await shift(filePath);
							conMap.delete(Path.basename(filePath, '.log'));
							oldStr.end('Log moved to dir: ' + date);
						} catch (e) {
							selfLog.error('Unable to roll up log file:', item.name);
							selfLog.error(e);
						}
					}
				}
			}
		} catch (e) {
			selfLog.error('Issue monitoring log files:', e.toString());
			selfLog.error(e.stack);
		}
	}
})();
