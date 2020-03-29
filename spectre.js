"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const log = require('debug-logger')('main');
const {token, prefix} = require('./config.json');
const {guildConfig} = require('./etc/guildConfig.js');
const Discord = require('discord.js');
const time = require('./etc/time.js');

const bot = new Discord.Client();
var modules, exec, getConfig;

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', async () => {
	let modLoader;
	log.info(time(), 'Bot ready');
	modLoader = require('./etc/moduleLoader.js')(bot);
	modules = modLoader.modules;
	exec = modLoader.exec;
});

bot.on('message', async (msg) => {
	try {
		let msgStr = msg.content.split(' '), cmd = modules.get(msgStr[0].substr(1)),
			pref = msg.guild ? guildConfig(msg.guild).prefix : prefix,
			disabled = (msg.guild && cmd) ? guildConfig(msg.guild).disabled.includes(cmd.command) : false;

		msgStr.shift();
		log.debug(time(), 'Found cmd:', cmd !== undefined, 'Disabled:', disabled, 'Message:', msg.content);
		if (cmd && msg.content.startsWith(pref) && !disabled) {
			if (msg.member && msg.member.permissionsIn(msg.channel).has(cmd.permissions(msg.guild))) {
				return await cmd[exec](msg, ...msgStr);
			} else if (!msg.member && !cmd.guildOnly) {
				return await cmd[exec](msg, ...msgStr);
			} else if (msg.member) log.warn('Member missing permissions for:', cmd.command);
		}
		return;
	} catch (e) {
		log.error(time(), 'There was an error executing a command', e.toString());
		log.error(e.stack);
	}
});

bot.on('error', e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
})

bot.login(token).catch(e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
}); //Bot Token
