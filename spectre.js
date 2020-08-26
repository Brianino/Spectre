#!/usr/bin/env node
"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const {time} = require('./etc/utilities.js');
const log = require('./etc/logger.js')('main');
const {run, modules} = require('./etc/moduleLoader.js');
const {token, prefix} = require('./config.json');
const {saved} = require('./etc/guildConfig.js');
const Discord = require('discord.js');
//const log2 = logFile('main');

const bot = new Discord.Client();

process.on('unhandledRejection', (e, origin) => {
	log.error(time(), 'Promise Error:', e.toString());
	log.error('At Promise:', origin);
	log.debug(e.stack);
});

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', async () => {
	log.info(time(), 'Connected to discord');
	try {
		await run(bot);
		log.info(time(), 'Bot ready');
	} catch (e) {
		log.error(time(), 'Something when wrong during startup for the bot');
		log.error(e);
		process.exit();
	}
});

bot.on('message', async (msg) => {
	try {
		let msgStr = msg.content.split(' '), cmd, tmp;

		if (msg.guild && (tmp = saved.get(msg.guild.id))) {
			if (!tmp) tmp = prefix;
			cmd = modules.get(msgStr[0].substr(tmp.prefix.length));
		} else cmd = modules.get(msgStr[0].substr(prefix.length));
		if (cmd) return await cmd.run(msg, ...msgStr);
		return;
	} catch (e) {
		log.error(time(), 'There was an error executing a command', e.toString());
		log.error(e.stack);
	}
});

bot.on('error', e => {
	log.error(time(), 'Bot error:', e.toString());
	log.debug(e.stack);
	log.file('ERROR', e);
});

bot.on('warn', info => {
	log.file('WARN', info);
});

bot.on('debug', info => {
	log.file.debug('debug', info);
});

bot.login(token).catch(e => {
	log.error(time(), 'Login error:', e.toString());
	log.debug(e.stack);
}); //Bot Token
