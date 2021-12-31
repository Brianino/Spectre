this.command = 'reload';
this.description = 'Reload a named module';
this.arguments = '<command>';
this.limit('users', OwnerID);

function inAll () {
	return async (msg, moduleStr) => {
		let moduleObj = modules.get(moduleStr);

		msg.delete();
		if (moduleObj) {
			try {
				await reload(moduleObj);
				return (await msg.channel.send('Reloaded: ' + moduleStr)).delete({timeout: 10000});
			} catch (e) {
				log.error('Unable to reload module');
				log.error(e);
			}
		} else if (!moduleStr) {
			try {
				await loadNew();
				return (await msg.channel.send('Loaded new modules')).delete({timeout: 10000});
			} catch (e) {
				log.error('Unable to load new moduleStr');
				log.error(e);
			}
		} else {
			return (await msg.channel.send('Unknown module `' + moduleStr + '`')).delete({timeout: 100000});
		}
	};
}
