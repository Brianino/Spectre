#!/usr/bin/env node
"use strict";

const log = require('./utils/logger.js')('Main');
const moduleLoader = require('./etc/ModuleLoader.js');
const {token, prefix} = require('./config.json');
const time = require('./utils/time.js');
const Discord = require('discord.js');

const bot = new Discord.Client();
const modLoader = new moduleLoader();

process.on('unhandledRejection', (e, origin) => {
	log.error('Promise Error:', e.toString());
	log.error('At Promise:', origin);
	log.debug(e.stack);
});

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', async () => {
	log.info('Connected to discord');
	try {
		modLoader.source = bot;
		await modLoader.setup();
		log.info('Client ready');
	} catch (e) {
		log.error('Something went wrong during startup for the bot');
		log.error(e);
		process.exit();
	}
});

bot.on('message', async (msg) => {
	try {
		await modLoader.runCommand(msg);
	} catch (e) {
		log.error('There was an error executing a command', e);
	}
});

bot.on('error', e => {
	log.error('Client error:', e);
});

bot.on('warn', info => {
	log.warn('Client warn:', info);
});

bot.on('debug', info => {
	log.debug('Client debug', info);
});

bot.login(token).catch(e => {
	log.error('Login error:', e.toString());
	log.debug(e.stack);
}); //Bot Token
