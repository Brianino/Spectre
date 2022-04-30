this.description = 'Repost images into an image gallery channel';
this.description = 'At least one source channel needs to be provided, and a gallery channel';
this.arguments = '<...source> to <gallery>';
this.arguments = 'delete <gallery>';
this.arguments = 'clear_missing';
this.arguments = '';
this.permissions = 'MANAGE_GUILD';

addConfig('repost_galleries', Map, { default: new Map(), configurable: false });
addConfig('repost_prefer_url', Boolean, { default: true, description: 'Prefer to post image url\'s rather than reuploading the file', configurable: true });
addConfig('repost_formats', Set, { default: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']), description: 'Image formats that should be reposted', configurable: true });

function inGuild (emitter) {
	const { getChannelID, getAttachments, checkForUrl, waitFor } = Utils, guild = this.guild;

	let att = false;
	const repost = async msg => {
		const gallList = this.config.repost_galleries.get(msg.channel.id) || [],
			urlCount = checkForUrl(msg.content, true, 'g').length,
			promises = [];

		if (msg.author.id === getBot().user.id)
			return;

		if (urlCount > 0) {
			await waitFor(10000, 50, async () => {
				try { await msg.fetch(); } catch (ignore) { return false; }
				return msg.embeds.length === urlCount;
			});
		}

		const attachments = getAttachments(msg, this.config.repost_formats),
			urls = attachments
				.filter(att => !att.name)
				.map(att => att.url),
			files = attachments
				.filter(att => att.name)
				.map(att => {
					return {
						attachment: att.url,
						name: att.name,
					};
				});

		if (!attachments.length)
			return;

		for (const cid of gallList) {
			const channel = msg.guild.channels.resolve(cid);

			if (!channel)
				continue;

			if (!this.config.repost_prefer_url)
				promises.push(sendFiles(channel, urls, files));
			else
				promises.push(sendUrls(channel, urls, files));
		}
		return Promise.allSettled(promises);
	};

	async function sendUrls (channel, urls, files) {
		try {
			await channel.send({ content: urls.concat(files.map(att => att.attachment)).join('\n') });
		} catch (e) {
			log.error(`Unable to repost to channel ${channel.id} due to:`, e);
		}
	}

	async function sendFiles (channel, urls, files) {
		try {
			await channel.send({
				content: urls.join('\n'),
				files: files,
			});
		} catch (e) {
			log.error('Failed to re-upload file', e);
			return sendUrls(channel, urls, files);
		}
	}

	if (this.config.repost_galleries.size) {
		emitter.on('messageCreate', repost);
		att = true;
	}

	async function parseInput (input) {
		const source = [];
		let gallery, tSwitch = false, type = 0;

		if (!input.length) {
			type = 1;
		} else if (input[0] === 'delete') {
			type = 2;
			gallery = await getChannelID(input.slice(1).shift(), guild, { allowText: 'partial' });
		} else if (input[0] === 'delete_source') {
			const tmp = input.slice(1, 2);
			type = 3;
			gallery = await getChannelID(tmp.shift(), guild, { allowText: 'partial' });
			source.push(await getChannelID(tmp.shift(), guild, { allowText: 'partial' }));
		} else if (input[0] === 'clear_missing') {
			type = 4;
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

	function addOrModifyRule (ruleMap, gallery, source) {
		if (!gallery)
			return 'Invalid gallery channel';
		if (!source.length)
			return 'No source channels to scan';
		for (const channel of source) {
			const current = ruleMap.get(source);

			if (!current)
				ruleMap.set(channel, [gallery]);
			else if (current.indexOf(gallery) < 0)
				current.push(gallery);
		}
		if (!att)
			emitter.on('messageCreate', repost);
		log.info('Setting up repost to channel', guild.channels.resolve(gallery).name, 'from', source.length, 'channels');
		return `Repost to <#${gallery}> configured`;
	}

	function listRules (ruleMap) {
		resMsg = 'Repost rules (channel => Image Channels):\n';
		for (const [source, galls] of ruleMap) {
			resMsg += `<#${source}> => `;
			resMsg += galls.map(val => `<#${val}>`).join(', ');
			resMsg += '\n';
		}
		return resMsg;
	}

	function deleteRule (ruleMap, gallery) {
		const res = [];
		for (const [source, current] of ruleMap) {
			let ind;

			if (current && (ind = current.indexOf(gallery)) >= 0) {
				current.splice(ind, 1);
				if (!current.length)
					ruleMap.delete(source);
				res.push(`<#${source}>`);
				log.debug('number of galleries:', current.length);
			}
			log.debug('Found?', current && ind >= 0);
			log.debug('Has index', ind);
		}
		if (res.length) {
			if (ruleMap.size)
				emitter.off('messageCreate', repost);
			return `channels ${res.toString()} will no longer post to <#${gallery}>`;
		} else {
			return 'Nothing to delete';
		}
	}

	function deleteSourceForRule (ruleMap, source, gallery) {
		const galleries = ruleMap.get(source), ind = galleries ? galleries.indexOf(gallery) : -1;
		if (ind >= 0) {
			galleries.splice(ind, 1);
			if (!galleries.length)
				ruleMap.delete(source);
			return `Channel <#${source}> will no longer post to <#${gallery}>`;
		}
		return 'Nothing to delete';
	}

	function clearMissingChannels (ruleMap) {
		const promises = [],
			processed = new WeakMap(),
			processChannel = async (channel) => {
				const ch = await getChannelID(channel, msg.guild);
				if (ch)
					return { status: 1, value: ch };
				else
					return { status: 2, value: channel };
			};
		let failed = 0, cleaned = 0;

		for (const [source, current] of ruleMap) {
			promises.push(processChannel(source)
				.then(({ status }) => {
					let tmp = [];
					switch (status) {
						case 1:
							tmp = current.map(channel => {
								if (processed.has(channel))
									return processed.get(channel);
								const res = processChannel(channel);
								processed.set(channel, res);
								return res;
							});
							break;

						case 2:
							ruleMap.delete(source);
							cleaned++;
							break;
					}
					return Promise.allSettled(tmp);
				})
				.then((promises) => {
					for (const { value, reason } of promises) {
						if (reason) {
							log.error('Unable to process channel', reason);
						} else if (value.status === 2) {
							const ind = current.indexOf(value.value);
							if (ind < 0) {
								log.error('Need to delete a missing channel?', current, value);
							} else {
								cleaned++;
								current.splice(ind, 1);
							}
						}
					}
				}));
		}
		for (const { reason } of Promise.allSettled(promises)) {
			if (reason) {
				log.error('Issue processing one of the rules', reason);
				failed++;
			}
		}
		if (failed)
			return 'There were some failures';
		else
			return `Cleaned up ${cleaned} channels that are no longer active`;
	}

	return async (msg, ...input) => {
		const [type, gallery, source] = await parseInput(input), tmap = this.config.repost_galleries;
		let resMsg = '';

		log.debug('Type is:', type);
		switch (type) {
			case 0: { // Add/Modify rule
				resMsg = addOrModifyRule(tmap, gallery, source);
				this.config.repost_galleries = tmap;
				break;
			}

			case 1: { // Show configured rules;
				resMsg = listRules(tmap);
				break;
			}

			case 2: { // Delete rule
				resMsg = deleteRule(tmap, gallery);
				this.config.repost_galleries = tmap;
				break;
			}

			case 3: { // Delete source from rule
				resMsg = deleteSourceForRule(tmap, source, gallery);
				this.config.repost_galleries = tmap;
				break;
			}

			case 4: { // Clear missing channels from rules
				resMsg = clearMissingChannels(tmap);
				this.config.repost_galleries = tmap;
				break;
			}
		}
		msg.channel.send({ content: resMsg });
	};
}
