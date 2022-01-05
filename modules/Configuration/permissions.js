this.description = 'Modifying required permissions for commands';
this.arguments = 'set <command> [...permission]';
this.arguments = 'show <command>';
this.arguments = 'list';
this.permissions = 'ADMINISTRATOR';

function inGuild () {
	const { Permissions } = discordjs;

	function setPermission (msg, command, perms) {
		const cmd = modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '')
			command = ' ';
		if (cmd && access.call(cmd, msg.author, msg.guild, this.config)) {
			perms.forEach((val, index) => {
				const tmp = Number(val);
				if (!isNaN(tmp))
					perms[index] = tmp;
				else
					perms[index] = String(val).toUpperCase();
			});
			try {
				this.config.permissions = [command, ...perms];
				return msg.channel.send(`Permissions for \`${command}\` updated`);
			} catch (e) {
				log.error('Failed to set permissions:', e.toString());
				log.debug(e.stack);
				return msg.channel.send('There was an error updating permissions, check server logs for more info');
			}
		} else {
			return msg.channel.send(`Could not find command \`${command}\``);
		}
	}

	function showPermission (msg, command) {
		const cmd =  modules.get(command = String(command));

		command = command.replace(/`/g, '');
		if (command === '')
			command = ' ';
		if (cmd && access.call(cmd, msg.author, msg.guild, this.config)) {
			const perms = this.config.permissions(cmd) || cmd.permissions || new Permissions();
			msg.channel.send({
				embed: {
					title: 'Permissions',
					fields: {
						name: command,
						value: `\`${perms.toArray(false).join('` `')}\``,
						inline: false,
					},
					color: 0xBB0000,
				},
			});
		} else {
			return msg.channel.send(`Could not find command \`${command}\``);
		}
	}

	function listPermission (msg) {
		const embed = {
			title: 'Permissions',
			color: 0xBB0000,
			fields: [],
		};
		for (const cmd of modules.values()) {
			const perms = this.config.permissions(cmd) || cmd.permissions || new Permissions();
			if (access.call(cmd, msg.author, msg.guild, this.config)) {
				embed.fields.push({
					name: cmd.command,
					value: `\`${perms.toArray(false).join('`\n`')}\``,
					inline: true,
				});
			}
		}
		return msg.channel.send({ embed });
	}

	return (msg, ...args) => {
		switch (args.shift()) {
			case 'list': // display permissions for all commands
				return listPermission.call(this, msg);

			case 'show': // display permissions for a command
				return showPermission.call(this, msg, args.shift());

			case 'set': // set the permissions for a command
				return setPermission.call(this, msg, args.shift(), args);

			default:
				return msg.channel.send('Unknown option, use either:\n' +
				'`list` (to list the permissions for all the commands)\n' +
				'`show` (to show the permissions for a single command)\n' +
				'`set` (to set the permissions for a command)');
		}
	};
}
