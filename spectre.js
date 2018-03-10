"use strict";
const color = require('color');
const Discord = require('discord.js');
const config = require('./config.js');
const modules = require('./Commands/commands.js');
const connection = require('./connection.js');
const dbInstantiator = require('./dbInstantiator.js');
const v = require('./dbVarTypes.js');

const bot = new Discord.Client();
const con = new connection("localhost", "root");
const dbI = new dbInstantiator(con);
const commands = new modules(con);

bot.on('ready', function () {
	console.log('bot ready'.green);
	console.log();
	dbI.checkDatabase();
});

bot.on('message', function (message) {
	//console.log(`Message: ${message.content}`);
	//check input for prefix
	//strip input of prefix before passing to command object
	if (isCommand(message)) {
		let arr = String(message.content).split(" "), found = false, count = 0;
		let mention = /<@[0-9]*>/, command = '';
		while (!found && count < arr.length) {
			if (mention.test(arr[count])) {
				arr.splice(count, 1);
				found == true;
			}
			count++;
		}
		command = arr[0];
		if (mention.test(command)) {
			command = String(message.content).split(" ")[1];
		}
		if (!commands.run(command, message)) {
			console.log(`Could not find ${command}`);
		}
	}
	//AUTOMATION OBJECT
})

function isCommand (message) {
	if (message.isMentioned(bot.user.id)) {
		return true;
	} else {
		let SQL = `SELECT ${v.gPr.split(' ')[0]} FROM ${config.database}.${v.g} WHERE ${v.gID.split(' ')[0]} = '${String(message.guild.id)}'`;
		//console.log(`Searching for prefix`);
		con.query(SQL, checkForPrefix, {msg: message});
		return false;
	}
}

function checkForPrefix (queryRes, params = {}) {
	let prefix = "";

	//console.log(`DB result from prefix search ${JSON.stringify(queryRes)}`);
	if (queryRes.length > 1) {
		console.log(`ERROR: Guild appears more than once in database`.red);
		console.log(`Please check the database manually and remove any duplicate entries`.red);
		console.log(`Auto DB cleaner not implemented`.red);
		return null;
	} else if (queryRes.length == 0) {
		let SQL = '';
		prefix = config.prefix;
		if (prefix.length == 0 || prefix.length > 5) {
			console.log(`'${config.prefix}' is not a valid prefix`);
			console.log(`Using '.' instead`);
		}
		prefix = prefix.split(' ').join('');
		console.log(`Setting ${params.msg.guild.name} command prefix to ${prefix}`);
		SQL = `INSERT INTO ${config.database}.${v.g} (${v.gID.split(' ')[0]},${v.gPr.split(' ')[0]}) VALUES ('${params.msg.guild.id}','${prefix}')`;
		con.query(SQL);
	} else {
		if (v.gPr.split(' ')[0] in queryRes[0]) {
			prefix = queryRes[0][v.gPr.split(' ')[0]];
		} else if (String(v.gPr.split(' ')[0]).toLowerCase() in queryRes[0]) {
			prefix = queryRes[0][v.gPr.split(' ')[0].toLowerCase()];
		} else {
			console.log(`Unexpected Result Format`);
			console.log(JSON.stringify(queryRes));
			for (let prop in queryRes[0]) {
				prefix = queryRes[0][prop];
			}
		}
	}
	if (params.msg.content.substring(0, prefix.length) == prefix) {
		let command = String(params.msg.content.split(" ")[0]).substring(1);
		//console.log(`ABOUT TO ATTEMPT ${command}`);
		if (!commands.run(command, params.msg)) {
			console.log(`Could not find ${command}`);
		}
	}
}

bot.login(config.token); //Bot Token