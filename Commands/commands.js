"use strict"; 
const command = require('./modules/command.js');
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
			let Guild = v.gID.split(" ")[0], Module = v.modID.split(" ")[0], Name = v.modNa.split(" ")[0], Glob = v.modGl.split(" ")[0], Fixed = String(v.modFi).split(" ")[0];
			let SQL = `SELECT ${Guild}, ${Name}, ${Glob}, ${Fixed} FROM ${config.database}.${v.GRmod} LEFT JOIN ${config.database}.${v.mod} ON ${v.GRmod}.${Module} = ${v.mod}.${Module} WHERE ${Guild} = ${message.guild.id}`;
			this._con.query(SQL, callfunc, {msg:message}, obj);
		}

		async function callfunc (queryRes, params, obj) {
			//check message allowed.
			let Guild = v.gID.split(" ")[0], Name = v.modNa.split(" ")[0], Glob = v.modGl.split(" ")[0], Fixed = String(v.modFi).split(" ")[0];
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