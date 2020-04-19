const log = require('debug-logger')('configure-module');
const {Permissions} = require('discord.js');
const time = require('../etc/time.js');

setupModule(function () {
	this.command = 'config';
	this.description = 'set server configuration';
	this.extraDesc = 'Adding no arguments will display the available settings to configure\n' +
	'using the setting with no value will display more info on the setting.'
	this.arguments = '<setting> [value]';
	this.arguments = '';
	this.permissions = 'MANAGE_GUILD';
	this.guildOnly = true;

	this.exec((msg, setting, ...input) => {
		let config = this.config(msg.guild.id), options = config.getConfigurable(),
			type, desc;

		if (options.has(setting)) {
			[type, desc] = options.get(setting)
		} else {
			let embed = {
				title: 'Settings:',
				color: 0xBB0000,
				description: 'Arrays and sets should be a space separated list\n' +
					'To revert to the default value enter the value `undefined`',
				fields: []
			};

			for (let [setting, [type, desc]] of options) {
				let val = {
					name: setting,
					value: type.name,
					inline: false
				}
				if (desc) val.value += ': ' + desc;
				embed.fields.push(val);
			}
			log.debug(time(), 'Posting settings info');
			return msg.channel.send({embed});
		}

		if (input.length > 0) {
			//set value
			if (input[0] === 'undefined') {
				config[setting] = undefined;
				log.info(time(), 'Setting', setting, 'for guild', msg.guild.name, 'reverted to default');
				return msg.channel.send('Setting reverted to default');
			}
			switch (type) {
				case String: config[setting] = input.join(' '); break;
				case Boolean: config[setting] = input.shift(); break;
				case Number: config[setting] = input.shift(); break;

				case Set:
				case Array: config[setting] = input; break;
				case Permissions: let temp = Number(input[0]);
				if (isNaN(temp)) temp = input;
				config[setting] = temp; break;
			}
			log.info(time(), 'Updated', setting, 'setting to', config[setting], 'for guild', msg.guild.name);
			return msg.channel.send('Updated the setting ' + setting);
		} else {
			//show setting info
			let embed = {
				title: setting,
				color: 0xBB0000,
				description: ''
			}

			if (desc) embed.description = desc + '\n';
			embed.description += 'Type: ' + type.name + '\n';
			embed.description += 'Current: ' + config[setting];

			return msg.channel.send({embed});
		}
	});
});
