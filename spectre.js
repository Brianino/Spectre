"use strict";
const Discord = require('discord.js');
const config = require('./config.json');

const bot = new Discord.Client();


bot.login(config.token); //Bot Token