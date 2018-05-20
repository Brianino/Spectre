"use strict"; 
const module = require('./module.js');
const v = require('./../etc/dbVarTypes.js');

class automationManager {
	constructor (connection) {
		this._con = connection;
		//this._speak = new module('speak', 'Get the bot to say something', '#command <input>', require('./modules/speak.js'), connection);
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
			let SQL = `SELECT ${Guild}, ${Name}, ${Glob}, ${Fixed} FROM ${v.ss('GRm')} LEFT JOIN ${v.ss('mod')} ON ${v.GRmod}.${Module} = ${v.mod}.${Module} WHERE ${Guild} = ${message.guild.id}`;
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

	isModule (input) {
		if ('_' + input in this) {
			return true;
		} else {
			return false;
		}
	}
}

module.exports = commands;