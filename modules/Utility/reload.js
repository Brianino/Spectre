this.command = 'reload';
this.description = 'Reload a named module';
this.arguments = '<command>';
this.limit('users', OwnerID);

function inAll () {
	const { sendMessage } = Utils;

	return async (msg, moduleStr) => {
		const moduleObj = modules.get(moduleStr),
			send = content => sendMessage(msg.channel, content, { cleanAfter: 10000 });
		let action = () => undefined, successMsg, failMsg;

		msg.delete();
		if (moduleObj) {
			action = reload.bind(moduleObj);
			successMsg = `Reloaded: ${moduleStr}`;
			failMsg = 'Unable to reload module';
		} else if (!moduleStr) {
			action = reload;
			successMsg = 'Loaded new modules';
			failMsg = 'Unable to load new modules';
		} else {
			return send(`Unknown module \`${moduleStr}\``);
		}

		try {
			await action();
			return send(successMsg);
		} catch (e) {
			log.error(failMsg, e);
			return send(failMsg);
		}
	};
}
