/* eslint no-undef: "warn" */
/* global access, addConfig, discordjs, getBot, getConfigurable, inspect, log, modules, OwnerID, timespan, Utils, _ */

this.description = 'repeat a message';
this.permissions = 'MANAGE_MESSAGES';

this.arguments = '[message to repeat]';

function inGuild (emitter) {
	const { getChannelID } = Utils;

	return async (msg, ...input) => {
		const res = await getChannelID(input, msg.guild, { allowText: 'partial', resolve: true });
		log.info('Channel is:', res);
		await msg.channel.send(String(res));
	};
}
