#!/usr/bin/env node

import ModuleLoader from './core/ModuleLoader.js';
import getConfig from './core/configUtils.js';
import { Client, Intents } from 'discord.js';
import logger from './core/logger.js';

const log = logger('Main'),
	bot = new Client({ intents: getIntents() }),
	modLoader = new ModuleLoader(),
	{ token, login_retries } = getConfig();

process.on('unhandledRejection', (e, origin) => {
	log.error('Promise Error:', e.toString());
	log.error('At Promise:', origin);
	log.debug(e.stack);
});

function getIntents () {
	let res = 0;
	res |= Intents.FLAGS.GUILDS;
	res |= Intents.FLAGS.GUILD_MEMBERS;
	res |= Intents.FLAGS.GUILD_BANS;
	res |= Intents.FLAGS.GUILD_MESSAGES;
	res |= Intents.FLAGS.GUILD_MESSAGE_REACTIONS;
	res |= Intents.FLAGS.DIRECT_MESSAGES;
	res |= Intents.FLAGS.DIRECT_MESSAGE_REACTIONS;
	log.info(`Using intents: ${res}`);
	return res;
}

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

bot.on('messageCreate', async (msg) => {
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

if (!token) {
	log.error('No token provided, please updated config.json');
	process.exit(2);
}

for (let count = 0; count < login_retries; count++) {
	try {
		log.info('Attempting login');
		await bot.login(token);
		break;
	} catch (e) {
		log.error('Login error:', e.toString());
		log.debug(e.stack);
	}
}

if (bot.user == null) {
	log.error('Failed to start bot, shutting down process');
	process.exit(1);
}
