const log = require('debug-logger')('ban-module');
const {modules} = require('../etc/moduleLoader.js');
const {owner} = require('../config.json');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'reload';
	this.description = 'Reload a command module';
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
		}
	});
});
