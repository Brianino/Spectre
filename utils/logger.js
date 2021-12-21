'use strict';

// For compatibility, this has been modified to just return the new log4js logger, as well as configure it when it is first initialised
const log4js = require('log4js');
const {promises:fs, constants} = require('fs');
const ac = new AbortController();
const log = log4js.getLogger();
const {signal} = ac;
const configFile = 'log.json';

log4js.configure(configFile);

(async () => {
  try {
    const watcher = fs.watch(configFile, {signal});
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

module.exports = (namespace) => log4js.getLogger(namespace);
