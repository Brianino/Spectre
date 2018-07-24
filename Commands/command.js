"use strict";
const color = require('colors');
const v = require('./../etc/dbVarTypes.js');

class command {
	constructor (name, desc, usage, method, connection = {}, fixed = false, isGlobal = true, linkedGuild = '') {
		this._name = name;
		this._desc = desc;
		this._con = connection;
		this.main = method;
		this.checkModule(usage, fixed, isGlobal, linkedGuild, this);
	}

	checkModule (usage, fixed, isGlobal, linkedGuild, obj) {
		//console.log(typeof(obj.con.instantiated));
		//console.log(`Attempting to instantiate ${obj.name}`);
		if (obj.con.instantiated) {
			let SQL = `SELECT * FROM ${v.ss('mod')} WHERE ${v.ss('modNa')} = '${obj.name}'`;
			obj.con.query(SQL, instantiateModule, {com: usage, fi:fixed, isGlobal: isGlobal, lg: linkedGuild}, obj);
		} else {
			setTimeout(obj.checkModule, 1000, usage, fixed, isGlobal, linkedGuild, obj);
		}

		function instantiateModule (queryRes = [], params = {}, obj) {
			if (queryRes.length > 1) {
				console.log(`Multiple Module Entries Found`.red);
			} else if (queryRes.length == 1) {
				//Check the data is the same
				let id = v.ss('modNa');
			} else {
				//Insert module data into database
				let name = v.ss('modNa'), desc = v.ss('modDe');
				let com = v.ss('modUs'), auto = v.ss('modAu');
				let glob = v.ss('modGl'), fixed = v.ss('modFi');
				let SQL = `INSERT INTO ${v.ss('mod')} (${name},${desc},${com},${auto},${glob},${fixed})`;
				SQL += ` VALUES ('${obj.name}','${obj.desc}','${params.com}',${false},${params.isGlobal},${params.fi})`;

				obj.con.query(SQL, step, {fi:params.fi, isGlobal: params.isGlobal, lg: params.lg}, obj);
			}

			function step (res = {}, params = {}, obj) {
				if (!params.isGlobal) {
					let SQL = `SELECT ${v.ss('modID')} FROM ${v.ss('mod')} WHERE ${v.ss('modNa')} = '${obj.name}'`;
					obj.con.query(SQL, enableCustom, params, obj);
				}
			}
		}

		function enableCustom (queryRes = [], params = {}, obj) {
			let guild = v.ss('gID'), module = v.ss('modID');
			let SQL = `INSERT INTO ${v.ss('GRm')} (${guild},${module})`;

			if (queryRes.length = 1) {
				SQL += ` VALUES ('${params.lg}',${queryRes[0].module})`;
				params.module.con.query(SQL);
			} else {
				console.log(`ERROR: ${obj.name} was not instantiated properly`.red);
				console.log(`${queryRes.length} results found in the module table`.red);
				setTimeout(step, 1000, params);
			}
		}
	}

	get name () {
		return this._name;
	}
	get desc () {
		return this._desc;
	}
	get con () {
		return this._con;
	}
}
module.exports = command;