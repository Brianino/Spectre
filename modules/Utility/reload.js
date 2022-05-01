this.command = 'reload';
this.description = 'Reload a named module';
this.arguments = '<command>';
this.limit('users', OwnerID);

function inAll () {
	const { sendMessage } = Utils;

	return async (msg, moduleStr) => {
		const send = content => sendMessage(msg.channel, content, { cleanAfter: 10000 });
		let action = () => undefined, successMsg, failMsg;

		msg.delete();
		if (moduleStr) {
			action = () => reload(moduleStr);
			successMsg = `Reloaded: ${moduleStr}`;
			failMsg = 'Unable to reload module';
		} else {
			action = loadNew;
			successMsg = 'Loaded new modules';
			failMsg = 'Unable to load new modules';
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
