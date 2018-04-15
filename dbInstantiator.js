"use strict";
const color = require('color');
const config = require('./config.js');
const v = require('./dbVarTypes.js');

class dbInstantiator {
	constructor (connection) {
		this._con = connection;
	}

	checkDatabase () {
		let SQL = "SHOW databases";
		//console.log(this);
		this.con.query(SQL, instantiateDB, {}, this);

		function instantiateDB (queryRes = [], params = {}, dbInst) {
			var dbE = false, dbN = '', created = false;
			var db = {};

			// MAY CHANGE THIS SO THAT THE TABLES ARE PREDEFINED OBJECTS AND THE STRINGS ARE CREATED FROM THOSE OBJECTS
			db[v.g] = `CREATE TABLE ${config.database}.${v.g} (${v.gID} ${v.pk},${v.gPr})`; // GUILD TABLE
			db[v.u] = `CREATE TABLE ${config.database}.${v.u} (${v.uID} ${v.pk},${v.uNa},${v.uRG},${v.uDe})`; // USER TABLE
			db[v.c] = `CREATE TABLE ${config.database}.${v.c} (${v.cID} ${v.pk},${v.cNa},${v.iTi},${v.cLo},${v.cBl},${v.cPa},${v.gID})`; // CHANNEL TABLE
			db[v.m] = `CREATE TABLE ${config.database}.${v.m} (${v.mID} ${v.pk},${v.uID},${v.cID},${v.mCo},${v.Tim},${v.mEd},${v.mDe},${v.mCm},${v.mOm},${v.mOb})`; // MESSAGE TABLE
			db[v.r] = `CREATE TABLE ${config.database}.${v.r} (${v.rID} ${v.pk},${v.rNa},${v.iTi},${v.rSe},${v.gID})`; // ROLE TABLE
			db[v.p] = `CREATE TABLE ${config.database}.${v.p} (${v.pID} ${v.nn} ${v.in} ${v.pk},${v.pNa},${v.pBi})`; // PERM TABLE
			db[v.mod] = `CREATE TABLE ${config.database}.${v.mod} (${v.modID} ${v.nn} ${v.in} ${v.pk},${v.modNa},${v.modDe},${v.modUs},${v.modAu},${v.modGl},${v.modFi})`; // MODULE TABLE
			db[v.war] = `CREATE TABLE ${config.database}.${v.war} (${v.warID} ${v.nn} ${v.in} ${v.pk},${v.uID},${v.gID},${v.warRe},${v.Tim},${v.warLi},${v.warBa})`; // WARNING TABLE
			db[v.fil] = `CREATE TABLE ${config.database}.${v.fil} (${v.filID} ${v.nn} ${v.in} ${v.pk},${v.filTa},${v.filFi})`; // FILTER TABLE
			db[v.GRr] = `CREATE TABLE ${config.database}.${v.GRr} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.uRG},${v.rID})`; // ROLE_GROUP TABLE
			db[v.GRp] = `CREATE TABLE ${config.database}.${v.GRp} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.pID},${v.gID},${v.modID})`; // PERM_GROUP TABLE
			db[v.GRw] = `CREATE TABLE ${config.database}.${v.GRw} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.warID},${v.mID})`; // WARNING_GROUP TABLE
			db[v.GRm] = `CREATE TABLE ${config.database}.${v.GRm} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.gID},${v.modID})`; // MODULE_GROUP TABLE
			db[v.GRb] = `CREATE TABLE ${config.database}.${v.GRb} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.uID},${v.gID},${v.modID})`; // BLOCKED_GROUP TABLE
			db[v.GRd] = `CREATE TABLE ${config.database}.${v.GRd} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.depS},${v.depD})`; // DEPENDENCY_TABLE TABLE
			db[v.GRfg] = `CREATE TABLE ${config.database}.${v.GRp} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.filID},${v.gID},${v.uID})`; // FILTER_GROUP_GUILD TABLE
			db[v.GRfc] = `CREATE TABLE ${config.database}.${v.GRp} (${v.GRID} ${v.nn} ${v.in} ${v.pk},${v.filID},${v.cID},${v.uID})`; // FILTER_GROUP_CHANNEL TABLE
			//console.log(`Attempting to instantiate ${config.database.green}`);
			if ("error" in params) {
				if (params.error) {
					dbInst.checkDatabase();
					dbE = false;
				}
			} else if ("dbE" in params) {
				dbE = params.dbE;
				if ("dbN" in params) {
					dbN = params.dbN;
				}
				if ("created" in params) {
					created = params.created;
				}
			}
			if (queryRes.length > 0 && !('error' in params) && !dbE) {
				let i = 0;
				while (i < queryRes.length && !dbE) {
					if (String(queryRes[i].Database).toLowerCase() == String(config.database).toLowerCase()) {
						dbE = true;
						dbN = queryRes[i].Database;
					}
					i++;
				}
				if (!dbE) {
					let SQL = `CREATE DATABASE ${config.database}`;
					console.log(`Creating ${config.database.green} database`);
					dbInst.con.query(SQL, instantiateDB, {dbE: true, dbN : dbN, created: true}, dbInst);
				}
			}
			if (dbE && created) {
				console.log(`Attempting to create tables!`.yellow);
				for (let prop in db) {
					console.log(`Creating ${prop} table`);
					dbInst.con.query(db[prop]);
				}
				dbInst.con.instantiated = true;
			} else if (dbE && !created) {
				//DB CHECK
				let tables = false
				if ("tables" in params) {
					tables = params.tables;
				}
				if (tables) {
					for (let prop in db) {
						let i = 0, exists = false;
						while (i < queryRes.length && !exists) {
							//console.log(queryRes[i]);
							//console.log(`${String(queryRes[i][`Tables_in_${dbN}`]).toLowerCase()} == ${String(prop).toLowerCase()}`)
							if (String(queryRes[i][`Tables_in_${dbN}`]).toLowerCase() == String(prop).toLowerCase()) {
								exists = true;
							}
							i++;
						}
						if (!exists) {
							console.log(`Creating ${prop} table`);
							dbInst.con.query(db[prop]);
						} else {
							//CHECK TABLE COLUMNS
						}
					}
					dbInst.con.instantiated = true;
				} else {
					let SQL = `SHOW tables FROM ${config.database}`;
					dbInst.con.query(SQL, instantiateDB, {dbE: true, dbN: dbN, created: false, tables: true}, dbInst);
				}
			}
		}
	}

	get con () {
		return this._con;
	}
}

module.exports = dbInstantiator;