/* eslint no-undef: "warn" */
/* global access, addConfig, discordjs, getBot, getConfigurable, inspect, log, modules, OwnerID, timespan, Utils, _ */

this.description = 'set the server welcome message';
this.description = 'user mention: {user}';
this.description = 'server name: {server}';
this.description = 'user name: {name}';

this.arguments = '<message>';
this.permissions = 'MANAGE_GUILD';

addConfig('welcome_message', String, { default: 'Welcome {user} to {server}', description: 'welcome message for users', configurable: true });
addConfig('welcome_bot_message', String, { description: 'message to display when bots join', configurable: true });
addConfig('welcome_channel', String, { description: 'where to display welcome message\n if it fails to display a message the value is changed back to undefined', configurable: true });

// Config options specifically for embed welcome messages
addConfig('welcome_embed', Boolean, { default: false, description: 'If true then the welcome message for this server will be an embed', configurable: true });
addConfig('welcome_title', String, { description: 'The title to use in the embeded welcome message (optional)', configurable: true });
addConfig('welcome_footer', String, { description: 'The footer message to use in the embeded welcome message (optional)', configurable: true });
addConfig('welcome_thumbnail', String, { description: 'The image link to use as a thumbnail in the embeded welcome message (small image top right)', configurable: true });
addConfig('welcome_image', String, { description: 'The image link to attach to an embeded welcome (image below the main text)', configurable: true });

function inGuild (emitter) {
	const { getChannelID, checkForUrl } = Utils,
		config = this.config;

	function replaceText (member, input) {
		input = _.toString(input);
		return _(input)
			.replace(/\{server\}/g, member.guild.name)
			.replace(/\{user\}/g, `<@${member.id}>`)
			.replace(/\{name\}/g, member.displayName);
	}

	function getMessage (member) {
		if (member.user.bot)
			return replaceText(member, config.welcome_bot_message);
		return replaceText(member, config.welcome_message);
	}

	function getUrlFrom (prop) {
		const res = checkForUrl(config[prop], true);

		if (res?.[0] !== config[prop])
			config[prop] = res?.[0];
		return res?.[0];
	}

	async function getMessageParts (member) {
		return {
			guild: member.guild,
			msg: getMessage(member),
			channel: await getChannelID(config.welcome_channel, member.guild, { allowText: 'partial', resolve: true }),
			// Embed details
			title: config.welcome_embed ? replaceText(member, config.welcome_title) : null,
			footer: config.welcome_embed ? replaceText(member, config.welcome_footer) : null,
			thumbnail: config.welcome_embed ? getUrlFrom('welcome_thumbnail') : null,
			image: config.welcome_embed ? getUrlFrom('welcome_image') : null,
		};
	}

	function handleMessage (channel, guild, arg) {
		if (!channel || channel.type !== 'GUILD_TEXT') {
			log.error('Unable to find welcome text channel for server', guild.name, '<->', guild.id);
			log.debug('Channel info', channel);
			return;
		}
		arg.allowedMentions = { parse: ['users']};
		log.debug('Sending welcome message to', channel?.name, 'args', arg);
		return channel.send(arg);
	}

	async function sendMessage (member) {
		const { channel, guild, msg } = await getMessageParts(member);
		return handleMessage(channel, guild, { content: msg });
	}

	async function sendEmbed (member) {
		const { title, footer, thumbnail, image, msg, channel, guild } = await getMessageParts(member),
			embed = { description: msg };

		if (title)
			embed.title = title;
		if (footer)
			embed.footer = { text: footer };
		if (thumbnail)
			embed.thumbnail = { url: thumbnail };
		if (image)
			embed.image = { url: image };
		return handleMessage(channel, guild, { embeds: [embed]});
	}

	emitter.on('guildMemberAdd', member => {
		if (!config.welcome_channel)
			return;
		log.info('Welcoming User', member.user.username, 'to', member.guild.name);
		if (config.welcome_embed)
			return sendEmbed(member);
		return sendMessage(member);
	});

	return (msg, ...input) => {
		const message = input.join(' ');

		log.info('Updating welcome message for', msg.guild.name, 'to:', message);
		if (message === '')
			this.config.welcome_message = undefined;
		else
			this.config.welcome_message = message;

		return msg.channel.send('Welcome message updated');
	};
}
