this.description = 'test stuff';
this.limit('users', OwnerID);

this.arguments = '';

function inGuild (emitter) {
	const component = Utils.PagedEmbed;
	let pagedEmbed;

	return async (msg, ...input) => {
		if (!pagedEmbed) {
			log.info('Creating paged embed');

			pagedEmbed = new component('test page');
			pagedEmbed.addPage('Test title A', new Map([['opt a1', 'val a1'], ['opt a2', 'val a2']]), 'A short desc A');
			pagedEmbed.addPage('Test title B', new Map([['opt b1', 'val b1'], ['opt b2', 'val b2']]), 'A short desc B');
			await pagedEmbed.sendTo(msg.channel);
			log.info('The paged embed should be setup');
		}
	};
}
