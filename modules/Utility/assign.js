this.description = 'Self assign a role';

this.arguments = '<role>';

addConfig('assign_roles', Set, { default: new Set(), description: 'Self assignable roles', configurable: true });

function inGuild () {
	const { getRoleID, sendMessage } = Utils;

	function idToMention (id) {
		return `<@&${id}>`;
	}

	return async (msg, input) => {
		const requestedRole = await getRoleID(input, msg.guild, { resolve: true, allowText: 'partial' }), promises = [];

		for (const role of this.config.assign_roles) {
			promises.push((async () => {
				const resolvedRole = await getRoleID(role, msg.guild, { resolve: true, allowText: 'partial' });

				if (role !== idToMention(resolvedRole.id)) {
					this.config.assign_roles.delete(role);
					this.config.assign_roles.add(idToMention(resolvedRole.id));
				}
				if (resolvedRole === requestedRole) {
					// assign role to user
					return msg.member.roles.add(resolvedRole).catch(e => {
						log.error('Unable to assign role', e);
						return sendMessage(msg.channel, 'can\'t assign role', { cleanAfter: 10000 });
					});
				}
			})());
		}
		return Promise.allSettled(promises);
	};
}
