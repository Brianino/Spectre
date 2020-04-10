"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const log = require('debug-logger')('main');
const {run, modules} = require('./etc/moduleLoader.js');
const {token} = require('./config.json');
const Discord = require('discord.js');
const time = require('./etc/time.js');

const bot = new Discord.Client();

//ADD POST INSTALL SCRIPT TO GENERATE CONFIG FILES
bot.on('ready', async () => {
	let modLoader;
	log.info(time(), 'Connected to discord ready');
	try {
		await run();
		log.info(time(), 'Bot ready');
	} catch (e) {
		log.error(time(), 'Something when wrong during startup for the bot');
		log.error(e);
		process.exit();
	}
});

bot.on('message', async (msg) => {
	try {
		let msgStr = msg.content.split(' '), cmd = modules.get(msgStr[0].substr(1));

		msgStr.shift();
		if (cmd) return await cmd.run(msg, ...msgStr);
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
