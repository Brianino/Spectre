"use strict";
const color = require('color');
const config = require('../../config.js');
const v = require('../../dbVarTypes.js');

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
			let SQL = `SELECT * FROM ${config.database}.${v.mod} WHERE ${String(v.modNa).split(" ")[0]} = '${obj.name}'`;
			obj.con.query(SQL, instantiateModule, {com: usage, fi:fixed, isGlobal: isGlobal, lg: linkedGuild}, obj);
		} else {
			setTimeout(obj.checkModule, 1000, usage, fixed, isGlobal, linkedGuild, obj);
		}

		function instantiateModule (queryRes = [], params = {}, obj) {
			if (queryRes.length > 1) {
				console.log(`Multiple Module Entries Found`.red);
			} else if (queryRes.length == 1) {
				//Check the data is the same
				let id = String(v.modNa).split(" ")[0];
			} else {
				//Insert module data into database
				let name = String(v.modNa).split(" ")[0];
				let desc = String(v.modDe).split(" ")[0];
				let com = String(v.modUs).split(" ")[0];
				let auto = String(v.modAu).split(" ")[0];
				let glob = String(v.modGl).split(" ")[0];
				let fixed = String(v.modFi).split(" ")[0];
				let SQL = `INSERT INTO ${config.database}.${v.mod} (${name},${desc},${com},${auto},${glob},${fixed})`;
				SQL += ` VALUES ('${obj.name}','${obj.desc}','${params.com}',${false},${params.isGlobal},${params.fi})`;

				obj.con.query(SQL, step, {fi:params.fi, isGlobal: params.isGlobal, lg: params.lg}, obj);
			}

			function step (res = {}, params = {}, obj) {
				if (!params.isGlobal) {
					let SQL = `SELECT ${String(v.modID).split(" ")[0]} FROM ${config.database}.${v.mod} WHERE ${String(v.modNa).split(" ")[0]} = '${obj.name}'`;
					obj.con.query(SQL, enableCustom, params, obj);
				}
			}
		}

		function enableCustom (queryRes = [], params = {}, obj) {
			let guild = String(v.gID).split(" ")[0];
			let module = String(v.modID).split(" ")[0];
			let SQL = `INSERT INTO ${config.database}.${v.GRm} (${guild},${module})`;

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