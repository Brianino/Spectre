const {getChannelID} = require('../utils/getDiscordObject.js');
const checkForUrl = require('../utils/checkForUrl.js');

this.description = 'set the server welcome message';
this.description = 'user mention: {user}';
this.description = 'server name: {server}';
this.description = 'user name: {name}';

this.arguments = '<message>';
this.permissions = 'MANAGE_GUILD';

addConfig('welcome_message', String, {default:'Welcome {user} to {server}', description: 'welcome message for users', configurable: true});
addConfig('welcome_bot_message', String, {description: 'message to display when bots join', configurable: true});
addConfig('welcome_channel', String, {description: 'where to display welcome message\n if it fails to display a message the value is changed back to undefined', configurable: true});

// Config options specifically for embed welcome messages
addConfig('welcome_embed', Boolean, {default: false, description: 'If true then the welcome message for this server will be an embed', configurable: true});
addConfig('welcome_title', String, {description: 'The title to use in the embeded welcome message (optional)', configurable: true});
addConfig('welcome_footer', String, {description: 'The footer message to use in the embeded welcome message (optional)', configurable: true});
addConfig('welcome_thumbnail', String, {description: 'The image link to use as a thumbnail in the embeded welcome message (small image top right)', configurable: true});
addConfig('welcome_image', String, {description: 'The image link to attach to an embeded welcome (image below the main text)', configurable: true});

function inGuild (emitter) {
	emitter.on('guildMemberAdd', async member => {
		let guild = member.guild, replaceText = (input) => {
			if (typeof input === 'string')
				return input.replace(/\{server\}/g, guild.name).replace(/\{user\}/g, '<@' + member.id + '>').replace(/\{name\}/g, member.displayName);
			else
				return undefined;
		};

		log.file.configuration('member joined:', guild.name, member.user.username, ':: welcome channel set?', this.config.welcome_channel? true : false);
		if (this.config.welcome_channel) {
			let msg;
			if (!member.user.bot) msg = replaceText(this.config.welcome_message);
			else msg = replaceText(this.config.welcome_bot_message);

			if (msg) {
				let channel = await getChannelID(this.config.welcome_channel, guild, {allowText: 'partial', resolve: true});
				log.debug('Channel result:', channel, 'type?', channel.type);
				if (channel && channel.type === 'text') {
					if (this.config.welcome_embed) {
						let title = replaceText(this.config.welcome_title),
							footer = replaceText(this.config.welcome_footer), embed = {description: msg};

						if (title) embed.title = title;
						if (footer) embed.footer = {text: footer};
						if (this.config.welcome_thumbnail) {
							let url = checkForUrl(this.config.welcome_thumbnail, true);

							if (url && url[0] === this.config.welcome_thumbnail) {
								if (url[0] !== this.config.welcome_thumbnail) this.config.welcome_thumbnail = url[0];
								embed.thumbnail = {url: url[0]};
							} else this.config.welcome_thumbnail = undefined;
						}
						if (this.config.welcome_image) {
							let url = checkForUrl(this.config.welcome_image, true);

							if (url && url[0] === this.config.welcome_image) {
								if (url[0] !== this.config.welcome_image) this.config.welcome_image = url[0];
								embed.image = {url: url[0]};
							} else this.config.welcome_image = undefined;
						}
						return channel.send({embed});
					} else {
						return channel.send(msg);
					}
				} else {
					log.error(time(), 'Unable to find welcome text channel');
					log.file.configuration('ERROR: unable to find welcome channel for server', guild.name, '<->', guild.id);
					this.config.welcome_channel = undefined;
				}
			} else return;
		}
	});

	return (msg, ...input) => {
		let message = input.join(' ');

		log.info(time(), 'Updating welcome message for', msg.guild.name, 'to:', message);
		log.file.configuration('INFO: updated welcome message for', msg.guild.name, 'to:', message);
		if (message === '') this.config.welcome_message = undefined;
		else this.config.welcome_message = message;

		return msg.channel.send('Welcome message updated');
	}
}
