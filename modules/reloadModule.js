const log = require('debug-logger')('reload-module');
const {modules, run} = require('../etc/moduleLoader.js');
const {time} = require('../etc/utilities.js');
const {owner} = require('../config.json');

setupModule(function () {
	this.command = 'reload';
	this.description = 'Reload a named module';
	this.arguments = '<command>';
	this.limit = ['users', owner];
	this.guildOnly = false;

	this.exec((msg, moduleStr) => {
		let moduleObj = modules.get(moduleStr);

		if (moduleObj) {
			try {
				moduleObj.reload();
				return msg.channel.send('Reloaded: ' + moduleStr);
			} catch (e) {
				log.error(time(), 'Unable to reload module');
				log.error(e);
				return msg.channel.send('Check server logs for more info');
			}
		} else {
			return run().then(() => {
				return msg.channel.send('Loaded new modules');
			}).catch(e => {
				log.error(time(), 'Unable to load new moduleStr');
				log.error(e);
				return msg.channel.send('Check server logs for more info');
			});
		}
	});
});
