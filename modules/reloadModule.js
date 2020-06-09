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

	this.exec(async (msg, moduleStr) => {
		let moduleObj = modules.get(moduleStr);

		msg.delete();
		if (moduleObj) {
			try {
				moduleObj.reload();
				return (await msg.channel.send('Reloaded: ' + moduleStr)).delete({timeout: 10000});
			} catch (e) {
				log.error(time(), 'Unable to reload module');
				log.error(e);
			}
		} else if (!moduleStr) {
			try {
				await run();
				return (await msg.channel.send('Loaded new modules')).delete({timeout: 10000});
			} catch (e) {
				log.error(time(), 'Unable to load new moduleStr');
				log.error(e);
			}
		} else {
			return (await msg.channel.send('Unknown module `' + moduleStr + '`')).delete({timeout: 100000});
		}
	});
});
