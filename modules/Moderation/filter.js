this.description = 'use a regex filter to remove messages and auto ban abusers';
this.description = 'Filter names must be unique, some names are reserved for common filters (list with common option)';
this.description = 'The exmept_role is used to define the lowest required role to be exempt from the filter';
this.description = 'All the active filters can be displayed with the list option';

this.arguments = 'add <filter_name> [exempt_role] <regex>';
this.arguments = 'add <common_filter_name> [exempt_role]';
this.arguments = 'del <filter_name>';
this.arguments = 'list';
this.arguments = 'common';

this.permissions = 'MANAGE_GUILD';
this.objectGroup = 'auto_mod';

addConfig('filter_regex', Map, { default: new Map(), configurable: false });
addConfig('filter_exempt', Map, { default: new Map(), configurable: false });
addConfig('filter_automod', Boolean, { default: true, configurable: true });

const common = {
	links: '([hH][tT]{2}[pP][sS]?://|www\\.)[^/:\\s]+(:\\d+)?(/\\S+)?',
	uri: '[^:\\s]+://([^\\s@]+@)?[^:\\s]+(:\\d+)?(/\\S+)?',
};

function inGuild (emitter, groupObj) {
	const { getRoleID, PagedEmbed, sendMessage } = Utils,
		{ Permissions } = discordjs,
		{ escapeRegExp } = _,
		guild = this.guild;

	UpdateCommonReg: {
		let updated = false;
		for (const name of this.config.filter_regex.keys()) {
			if (name in common) {
				this.config.filter_regex.set(name, new RegExp(common[name]));
				updated = true;
			}
		}
		if (updated)
			this.config.filter_regex = this.config.filter_regex;
	}

	async function checkExempt (member, exemptRole) {
		if (member?.permissions.has(Permissions.FLAGS.ADMINISTRATOR))
			return true;
		else if (!exemptRole)
			return false;
		else if (member?.roles.highest.comparePositionTo(await getRoleID(exemptRole, guild, { resolve: true })) >= 0)
			return true;
		else
			return false;
	}

	emitter.on('messageCreate', async msg => {
		for (const [name, reg] of this.config.filter_regex) {
			log.debug('Will check', msg.content, ' against', reg.toString());
			if (msg.content.match(reg)) {
				log.debug('Message has a match');
				// check user has exempt role
				if (await checkExempt(msg.member, this.config.filter_exempt.get(name)))
					return log.debug('User is exempt from filter due to higher role');
				log.info('Deleting filtered message', msg.content, 'from user', msg.author.username, `(${msg.author.id}-${msg.guild.name})`);
				msg.delete().catch(ignore => {
					log.error('Unable to delete filtered message', msg.content, 'from user', msg.author.username, `(${msg.author.id})`);
				});
				if (groupObj.autoban)
					groupObj.autoban(msg);
			}
		}
	});

	async function addFilter (filterName, exempt, regex) {
		if (filterName in common) {
			regex = common[filterName];
		} else if (!regex && exempt) {
			regex = escapeRegExp(exempt);
			exempt = undefined;
		} else if (!regex) {
			throw new SyntaxError('Missing regex');
		} else {
			regex = escapeRegExp(regex);
		}
		if (exempt)
			this.config.filter_exempt.set(filterName, await getRoleID(exempt, this.guild));
		this.config.filter_regex.set(filterName, new RegExp(regex));
		// Work around to enable saving of config varibales, as using object methods doesn't trigger the config variable setter
		this.config.filter_exempt = this.config.filter_exempt;
		return this.config.filter_regex = this.config.filter_regex;
	}

	function delFilter (filterName) {
		this.config.filter_exempt.delete(filterName);
		this.config.filter_regex.delete(filterName);
		this.config.filter_exempt = this.config.filter_exempt;
		return this.config.filter_regex = this.config.filter_regex;
	}

	function list (msg) {
		const listEmbed = new PagedEmbed();
		let rows = [...this.config.filter_regex.keys()];

		if (rows.length) {
			rows = rows.map(name => [name, this.config.filter_exempt.has(name) ? `Exempt Role: <@&${this.config.filter_exempt.get(name)}>` : 'Only Admins are exempt']);
			listEmbed.addPage('Active Filters', rows, 'The filter name and the lowest exempt role');
		} else {
			listEmbed.addPage('No Active Filters', undefined, 'Set up a filter with the filter add command');
		}
		return listEmbed.sendTo(msg.channel);
	}

	function listCommon (msg) {
		const listEmbed = new PagedEmbed(), rows = Object.entries(common);

		listEmbed.addPage('Common Filters', rows, 'Regex filters for common filters that may be applied');
		return listEmbed.sendTo(msg.channel);
	}

	return async (msg, action, filterName, exempt, regex) => {
		switch (action) {
			case 'a':
			case 'add': {
				try {
					return await addFilter.call(this, filterName, exempt, regex);
				} catch (e) {
					if (e instanceof SyntaxError)
						sendMessage(msg.channel, `Unable to create the filter: ${e.message}`, { cleanAfter: 10000 });
					throw e;
				}
			}

			case 'd':
			case 'del':
			case 'delete': return delFilter.call(this, filterName);

			case 'l':
			case 'li':
			case 'list': return list.call(this, msg);

			case 'c':
			case 'common': return listCommon.call(this, msg);

			default: return sendMessage(msg.channel, 'Please pick between options add/del/list/common', { cleanAfter: 10000 });
		}
	};
}
