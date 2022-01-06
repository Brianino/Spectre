#!/usr/bin/env node

import Discord from 'discord.js';
import logger from './core/logger.js';
import ModuleLoader from './core/ModuleLoader.js';
import { readFile } from 'fs/promises';

const log = logger('Main'),
	bot = new Discord.Client(),
	modLoader = new ModuleLoader();

process.on('unhandledRejection', (e, origin) => {
	log.error('Promise Error:', e.toString());
	log.error('At Promise:', origin);
	log.debug(e.stack);
});

// ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
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

readFile(new URL('./config.json', import.meta.url)).then((data) => {
	const { token } = JSON.parse(data);
	bot.login(token).catch(e => {
		log.error('Login error:', e.toString());
		log.debug(e.stack);
	}); // Bot Token
});
