"use strict";
if (!process.env.DEBUG) process.env.DEBUG = '*:log,*:info,*:warn,*:error';
const modules = require('./etc/moduleLoader.js');
const log = require('debug-logger')('main');
const Discord = require('discord.js');
const time = require('./etc/time.js');
const fs = require('fs');

try {
	const {token, ...config} = require('./config.json');
} catch (e) {
	fs.writeFileSync('./config.json', JSON.stringify({
		token: ""
	}));
	log.log('config.json file created');
	process.exit();
}

const bot = new Discord.Client();

bot.on('ready', () => {
	log.info(time(), 'Bot ready');
});

bot.on('error', e => {
	log.error(time(), e.toString());
	log.debug(e.stack);
})

//bot.login(token); //Bot Token
