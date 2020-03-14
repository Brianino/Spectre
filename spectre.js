"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const log = require('debug-logger')('main');
const config = require('./config.json');
const Discord = require('discord.js');
const time = require('./etc/time.js');

const bot = new Discord.Client();
var modules, exec;

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', () => {
	let modLoader;
	log.info(time(), 'Bot ready');
	modLoader = require('./etc/moduleLoader.js');

	modules = modLoader.modules;
	exec = modLoader.exec;
});

bot.on('message', msg => new Promise((resolve, reject) => {
	let msgStr = msg.content.split(' ');
	let cmd = modules.get(msgStr[0].substr(1));

	msgStr.shift();
	log.debug(time(), 'Found cmd:', cmd !== undefined, 'Message:', msg.content);
	if (cmd && msg.content.startsWith(config.prefix)) {
		if (msg.member && msg.member.permissionsIn(msg.channel).has(cmd.permissions(msg.guild))) {
			return cmd[exec](msg, ...msgStr);
		} else if (!msg.member && !cmd.guildOnly) {
			return cmd[exec](msg, ...msgStr);
		} else if (msg.member) log.warn('Member missing permissions for:', cmd.command);
	}
	return;
}).catch(e => {
	log.error(time(), 'There was an error executing a command', e.toString());
	log.error(e.stack);
}));

bot.on('error', e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
})

bot.login(config.token).catch(e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
}); //Bot Token
