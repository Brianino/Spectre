"use strict"; 
const command = require('./command.js');
const config = require('../config.js');
const v = require('../dbVarTypes.js');

class commands {
	constructor (connection) {
		this._con = connection;
		this._speak = new command('speak', 'Get the bot to say something', '#command <input>', require('./modules/speak.js'), connection);
	}

	run (input, message) {
		// TURN THIS INTO A PROMISE
		if ('_' + input in this && input != "con") {
			checkFunc(this['_' + input], message);
			return true;
		} else {
			return false;
		}

		function checkFunc (obj, message) {
			let Guild = v.ss('gID'), Module = v.ss('modID'), Name = v.ss('modNa'), Glob = v.ss('modGl'), Fixed = v.ss('modFi');
			let SQL = `SELECT ${Guild}, ${Name}, ${Glob}, ${Fixed} FROM ${config.database}.${v.GRmod} LEFT JOIN ${config.database}.${v.mod} ON ${v.GRmod}.${Module} = ${v.mod}.${Module} WHERE ${Guild} = ${message.guild.id}`;
			this._con.query(SQL, callfunc, {msg:message}, obj);
		}

		async function callfunc (queryRes, params, obj) {
			//check message allowed.
			let Guild = v.ss('gID'), Name = v.ss('modNa'), Glob = v.ss('modGl'), Fixed = v.ss('modFi');
			let message = params.msg, count = 0, found = false;

			while (!found && count < queryRes.length) {
				if (queryRes[count][Name] == obj.name) {
					found = true; count--;
				}
				count++;
			}
			if (found || (queryRes[count][Glob] && queryRes[count][Fixed])) {
				obj.main(message);
			} else {
				console.log(`${obj.name} disabled on this server`);
			}
		}
	}

	isCommand (input) {
		if ('_' + input in this) {
			return true;
		} else {
			return false;
		}
	}
}

module.exports = commands;