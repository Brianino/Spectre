#!/usr/bin/env node
"use strict";

const log = require('./utils/logger.js')('main');
const moduleLoader = require('./etc/moduleLoader.js');
const {token, prefix} = require('./config.json');
const {saved} = require('./etc/guildConfig.js');
const time = require('./utils/time.js');
const Discord = require('discord.js');
//const log2 = logFile('main');

const bot = new Discord.Client();
const modLoader = new moduleLoader();

process.on('unhandledRejection', (e, origin) => {
	log.error(time(), 'Promise Error:', e.toString());
	log.error('At Promise:', origin);
	log.debug(e.stack);
});

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', async () => {
	log.info(time(), 'Connected to discord');
	try {
		modLoader.source = bot;
		await modLoader.setup();
		log.info(time(), 'Bot ready');
	} catch (e) {
		log.error(time(), 'Something went wrong during startup for the bot');
		log.error(e);
		process.exit();
	}
});

bot.on('message', async (msg) => {
	try {
		await modLoader.runCommand(msg);
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
