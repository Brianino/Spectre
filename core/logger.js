

// For compatibility, this has been modified to just return the new log4js logger, as well as configure it when it is first initialised
import log4js from 'log4js';
import fs from 'fs/promises';

if (!process.env.TEST) {
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
} else {
	log4js.configure({
		appenders: {
			testlog: {
				type: 'multiFile',
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
}

export default (namespace) => log4js.getLogger(namespace);
