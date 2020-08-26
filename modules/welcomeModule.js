const log = require('../etc/logger.js')('welcome-module');
const {time, checkForUrl} = require('../etc/utilities.js');

setupModule(function () {
	this.command = 'welcome';
	this.description = 'set the server welcome message';
	this.extraDesc = 'user mention: {user}\nserver name: {server}\nuser name: {name}'
	this.arguments = '<message>';
	this.permissions = 'MANAGE_GUILD';
	this.guildOnly = true;

	this.addConfig('welcome_message', String, 'Welcome {user} to {server}', 'welcome message for users');
	this.addConfig('welcome_bot_message', String, undefined, 'message to display when bots join');
	this.addConfig('welcome_channel', String, undefined, 'where to display welcome message\n if it fails to display a message the value is changed back to undefined');

	// Config options specifically for embed welcome messages
	this.addConfig('welcome_embed', Boolean, false, 'If true then the welcome message for this server will be an embed');
	this.addConfig('welcome_title', String, undefined, 'The title to use in the embeded welcome message (optional)');
	this.addConfig('welcome_footer', String, undefined, 'The footer message to use in the embeded welcome message (optional)');
	this.addConfig('welcome_thumbnail', String, undefined, 'The image link to use as a thumbnail in the embeded welcome message (small image top right)');
	this.addConfig('welcome_image', String, undefined, 'The image link to attach to an embeded welcome (image below the main text)');

	this.bot.on('guildMemberAdd', member => {
		let guild = member.guild, replaceText = (input) => {
			if (typeof input === 'string')
				return input.replace(/\{server\}/g, guild.name).replace(/\{user\}/g, '<@' + member.id + '>').replace(/\{name\}/g, member.displayName);
			else
				return undefined;
		};

		log.info('member joined:', guild.name, member.user.username);
		if (this.config.welcome_channel) {
			let msg = '';
			if (!member.user.bot) msg = this.config.welcome_message;
			else msg = this.config.welcome_bot_message;

			if (msg) {
				let channel, tmp;
				msg = replaceText(msg);

				if (tmp = /(?<=^\<#)\d{17,19}(?=\>$)/.exec(this.config.welcome_channel)) {
					channel = guild.channels.resolve(tmp[0])
				} else if (/^\d{17,19}$/.exec(this.config.welcome_channel)) {
					channel = guild.channels.resolve(this.config.welcome_channel);
				} else {
					channel = guild.channels.cache.find(channel => channel.name.includes(this.config.welcome_channel));
				}

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
					this.config.welcome_channel = undefined;
				}
			} else return;
		}
	});

	this.exec((msg, ...input) => {
		let message = input.join(' ');

		log.info(time(), 'Updating welcome message for', msg.guild.name, 'to:', message);
		if (message === '') this.config.welcome_message = undefined;
		else this.config.welcome_message = message;

		return msg.channel.send('Welcome message updated');
	});
});
