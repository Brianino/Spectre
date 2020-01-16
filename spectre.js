"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const log = require('debug-logger')('main');
const Discord = require('discord.js');
const time = require('./etc/time.js');
const fs = require('fs');

var config, modules;
try {
	config = require('./config.json');
} catch (e) {
	log.error(time(), e.toString);
	fs.writeFileSync('./config.json', JSON.stringify({
		token: "",

	}, undefined, '\t'), 'wx');
	log.log('config.json file created');
	process.exit();
}

global.bot = new Discord.Client();

bot.on('ready', () => {
	log.info(time(), 'Bot ready');
	modules = require('./etc/moduleLoader.js');
});

bot.on('error', e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
})

bot.login(config.token).catch(e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
}); //Bot Token
