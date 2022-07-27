import log4js from 'log4js';
import { configure as multiFileAppender } from 'log4js/lib/appenders/multiFile.js';
import fs from 'fs/promises';

class LogAppender {
	#categories = new Map();

	listen (categoryName, wipe = true) {
		let weakRef = this.#categories.get(categoryName),
			val = weakRef?.deref();

		if (val) {
			if (wipe)
				val.splice(0, val.length);
			return val;
		}

		val = [];
		weakRef = new WeakRef(val);
		this.#categories.set(categoryName, weakRef);
		return val;
	}

	handleLogEvent (loggingEvent) {
		const categoryName = loggingEvent.categoryName,
			collection = this.#categories.get(categoryName)?.deref();

		if (collection)
			collection.push(loggingEvent);
	}
}

const logAppender = new LogAppender();

switch (process.env.TEST) {

	case 'false': normal_setup: {
		const log = log4js.getLogger(),
			configFile = 'log.json',
			ac = new AbortController(),
			{ signal } = ac;

		log4js.configure(configFile);
		(async () => {
			try {
				const watcher = fs.watch(configFile, { signal });
				let lastEv = 0;
				for await (const event of watcher) {
					if (event.eventType === 'change' && Date.now() - lastEv > 10) {
						// Added a grace period to catch back to back events
						log.info('Updating log configuration');
						lastEv = Date.now();
						log4js.shutdown();
						log4js.configure(configFile);
					}
				}
			} catch (err) {
				if (err.name === 'AbortError')
					return;
				throw err;
			}
		})();
		break;
	}



	case 'true': test_setup: {
		// Setup default log rules when running tests
		// Setup test appender that tests can use to read logs
		const proxyAppender = {
			configure: (config, layouts) => {
				const fileAppender = multiFileAppender(config, layouts);

				return (loggingEvent) => {
					logAppender.handleLogEvent(loggingEvent);
					return fileAppender(loggingEvent);
				};
			},
		};

		log4js.configure({
			appenders: {
				testlog: {
					type: proxyAppender,
					base: 'test/logs/',
					extension: '.log',
					property: 'categoryName',
					maxLogSize: 536870912,
					backups: 0,
					flags: 'w',
					layout: {
						type: 'pattern',
						pattern: '%d{dd/MM/yy hh:mm:ss} %c %p %f{1} %m',
					},
				},
			},
			categories: {
				default: {
					appenders: ['testlog'],
					level: 'all',
					enableCallStack: true,
				},
			},
		});
		break;
	}

	default:
		console.log('Somthing went horribly wrong setting up the logger');
		process.exit(1);
}

export default (namespace) => log4js.getLogger(namespace);

export { logAppender };
