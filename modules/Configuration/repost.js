this.description = 'Repost images into an image gallery channel';
this.description = 'At least one source channel needs to be provided, and a gallery channel';
this.arguments = '<...source> to <gallery>';
this.permissions = 'MANAGE_GUILD';

addConfig('repost_galleries', Map, { default: new Map(), configurable: false });
addConfig('repost_prefer_url', Boolean, { default: true, description: 'Prefer to post image url\'s rather than reuploading the file', configurable: true });
addConfig('repost_formats', Set, { default: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']), description: 'Image formats that should be reposted', configurable: true });

function inGuild (emitter) {
	const { getChannelID, getAttachments, checkForUrl, waitFor } = Utils;

	// modify this so that the listener is only attached if there is a gallery set for the guild
	let att = false;
	const repost = async msg => {
		const gallList = this.config.repost_galleries.get(msg.channel.id) || [],
			urlCount = checkForUrl(msg.content, true, 'g').length;
		let attachments = [];

		if (msg.author.id === getBot().user.id)
			return;
		if (urlCount > 0) {
			await waitFor(10000, 50, async () => {
				try { await msg.fetch(); } catch (ignore) { return false; }
				return msg.embeds.length === urlCount;
			});
		}
		attachments = getAttachments(msg, this.config.repost_formats);
		if (!attachments.length)
			return;
		for (const cid of gallList) {
			const channel = msg.guild.channels.resolve(cid);

			if (channel) {
				const urls = attachments.filter(att => !att.name).map(att => att.url), files = attachments.filter(att => att.name).map(att => {
					return {
						attachment: att.url,
						name: att.name,
					};
				});

				if (this.config.repost_prefer_url) {
					await channel.send(urls.concat(files.map(att => att.attachment)).join('\n'));
				} else {
					await channel.send({
						content: urls.join('\n'),
						files: files,
					}).catch(e => {
						log.error('Failed to re-upload file', e);
						return channel.send(urls.concat(files.map(att => att.attachment)).join('\n'));
					});
				}
			}
		}
	};

	if (this.config.repost_galleries.size) {
		emitter.on('message', repost);
		att = true;
	}

	async function parseInput (input, guild) {
		const source = [];
		let gallery, tSwitch = false, type = 0;

		if (!input.length) {
			type = 2;
		} else if (input[0] === 'delete') {
			type = 1;
			gallery = await getChannelID(input.slice(1).shift(), guild, { allowText: 'partial' });
		} else {
			for (const val of input) {
				switch (val) {
					case 'to': tSwitch = true; break;

					default:
						if (tSwitch)
							gallery = await getChannelID(val, guild, { allowText: 'partial' });
						else
							source.push(await getChannelID(val, guild, { allowText: 'partial' }));
						break;
				}
			}
		}
		return [type, gallery, source];
	}

	return async (msg, ...input) => {
		const [type, gallery, source] = await parseInput(input, msg.guild), tmap = this.config.repost_galleries;
		let resMsg = '';

		log.debug('Type is:', type);
		switch (type) {
			case 0: { // Add/Modify rule
				if (!gallery)
					return msg.channel.send('Invalid gallery channel');
				if (!source.length)
					return msg.channel.send('No source channels to scan');
				for (const channel of source) {
					const current = tmap.get(source);

					if (!current)
						tmap.set(channel, [gallery]);
					else if (current.indexOf(gallery) < 0)
						current.push(gallery);
				}
				this.config.repost_galleries = tmap;
				if (!att)
					emitter.on('message', repost);
				log.info('Setting up repost to channel', msg.guild.channels.resolve(gallery).name, 'from', source.length, 'channels');
				resMsg = `Repost to <#${gallery}> configured`;
			}
				break;

			case 1: { // Delete rule
				const res = [];
				for (const [source, current] of tmap) {
					let ind;

					if (current && (ind = current.indexOf(gallery)) >= 0) {
						current.splice(ind, 1);
						if (!current.length)
							tmap.delete(source);
						res.push(`<#${source}>`);
						log.debug('number of galleries:', current.length);
					}
					log.debug('Found?', current && ind >= 0);
					log.debug('Has index', ind);
				}
				if (res.length) {
					resMsg = `channels ${res.toString()} will no longer post to <#${gallery}>`;
					if (tmap.size)
						emitter.off('message', repost);
					this.config.repost_galleries = tmap;
				} else {
					resMsg = 'Nothing to delete';
				}
			}
				break;

			case 2: { // Show configured rules;
				resMsg = 'Repost rules (channel => Image Channels):\n';
				for (const [source, galls] of tmap) {
					resMsg += `<#${source} => `;
					resMsg += galls.map(val => `<#${val}>`).join(', ');
					resMsg += '\n';
				}
			}
				break;
		}
		msg.channel.send(resMsg);
	};
}
