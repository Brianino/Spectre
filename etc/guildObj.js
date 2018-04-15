"use strict";
//GUILD OBJECT FOR CASHING GUILD DATA
const config = require('../config.js');
const v = require('./dbVarTypes.js');

class guildCache {
	constructor (con, guildId) {
		let SQL = `SELECT ${guildId} FROM ${config.database}.${v.g} WHERE ${v.ss('gID')} = '${String(guildId)}'`;
		this._con = con;
		this._id = guildId;
		this._prefix = config.prefix;
		this._messages = [];
		this._priority = 0;
		if (config.messageLimit >= 100) {
			this._imposedLimit = 100;
		} else if (config.messageLimit < 0) {
			this._imposedLimit = config.messageLimit;
		} else {
			this._imposedLimit = 0;
		}
		con.query(SQL, loadPrefix, {guildId: guildId}, this);

		//get prefix

		function loadPrefix (queryRes, params, obj) {
			let temp = '';
			if (queryRes.length == 0 || queryRes.length > 1) {
				let SQL = '';
				temp = config.prefix;
				if (queryRes.length > 1) {
					console.log(`ERROR: Guild appears more than once in database`.red);
					console.log(`Please check the database manually and remove any duplicate entries`.red);
					console.log(`Auto DB cleaner not implemented`.red);
				} 
				if (temp.length == 0 || temp.length > 5) {
					console.log(`'${config.prefix}' is not a valid prefix`);
					console.log(`Using '.' instead`);
				}
				temp = temp.split(' ').join('');
				obj._prefix = temp;
				if (queryRes.length == 0) {
					console.log(`Setting ${params.guildId} command prefix to ${temp}`);
					SQL = `INSERT INTO ${config.database}.${v.g} (${v.ss('gID')},${v.ss('gPr')}) VALUES ('${params.guildId}','${temp}')`;
					con.query(SQL);
				}
			} else {
				if (v.ss('gPr') in queryRes[0]) {
					obj._prefix = queryRes[0][v.ss('gPr')];
				} else if (String(v.ss('gPr')).toLowerCase() in queryRes[0]) {
					obj._prefix = queryRes[0][v.ss('gPr').toLowerCase()];
				} else {
					console.log(`Unexpected Result Format`);
					console.log(JSON.stringify(queryRes));
					for (let prop in queryRes[0]) {
						obj._prefix = queryRes[0][prop];
					}
				}
			}
		}
	}

	get id () {
		this._priority++;
		return this._id;
	}

	get priority () {
		return this._priority;
	}

	set imposedLimit (input) {
		if (input > config.messageLimit) {
			input = config.messageLimit;
		}
		if (input < 0) {
			input = 0;
		}
		this._imposedLimit = input;
	}

	get imposedLimit (input) {
		return this._imposedLimit;
	}

	set lastMessage (message, isCom = false, editFrom = {}) {
		//let SQL = makeQuery(message, isCom, eitedFrom);
		let limit = (this._priority + 1) * 10;

		if (!message.system && String(message.guild.id) == String(this._id)) {
			if (limit > this._imposedLimit) {
				limit = this._imposedLimit;
			}
			if (this._messages.length >= limit && limit > 0) {
				//trim
				this._messages.splice(0,1);
				this._messages.push(message);
			} else if (limit > 0) {
				this._messages.push(message);
			}
			sendQuery(msg, isCom, editFrom);
		} else {
			if (String(message.guild.id) != String(this._id)) {
				throw {
					name:"wrong guild message",
					message: `a message from ${message.guild.id} was sent to the object for guild ${this._id}`
				}
			}
		}
		//add to db

		function sendQuery (msg, isCom = false, editFrom = {}) {
			let mID = v.ss('mID'), uID = v.ss('uID'), cID = v.ss('cID'), mCo = v.ss('mCo'), Tim = v.ss('Tim');
			let mEd = v.ss('mEd'), mDe = v.ss('mDe'), mCm = v.ss('mCm'), mOm = v.ss('mOm'), mOb = v.ss('mOb');
			let SQL = `INSERT INTO ${config.database}.${v.m} `, columns = '', values = '', arr = '';

			columns = `(${mID},${uID},${cID},${mCo},${Tim},${mDe},${mCo},${mOb},${mEd}`;
			values = ` VALUES (?,?,?,?,?,?,?,?,?`;
			values+= `${false},${isCom},${msg},`;
			arr.push(msg.id);
			arr.push(msg.author.id);
			arr.push(msg.channel.id);
			arr.push(msg.content);
			arr.push(msg.createdTimestamp);
			arr.push(false);
			arr.push(isCom);
			arr.push(msg);
			if (Object.keys(editFrom).length == 0) {
				columns+= `) `;
				values+= `)`;
			} else {
				columns+= `,${mOm}) `;
				values+= `,?)`;
				arr.push(editFrom.id);
			}
			SQL+= columns + values;

			this._con.queryEsc(SQL,arr);
		}
	}

	get prefix () {
		this._priority++;
		return this._prefix;
	}

	set prefix (input) {
		let SQL = SQL = `INSERT INTO ${config.database}.${v.ss('g')} (${v.ss('gID')},${v.ss('gPr')}) VALUES ('${this._id}','${prefix}')`;

		this._con.query(SQL);
		this._prefix = input;
	}

	getlastMessage (callback, channel = null, user = null) {
		let cID = v.ss('cID'), gID = v.ss('gID');
		let guildStr = `${v.g}.${v.ss('gID')} = ${this._id}`;
		let from = `FROM ${v.ss('m')} LEFT JOIN ${v.c} ON ${v.c}.${cID} = ${v.m}.${cID} LEFT JOIN ${v.g} ON ${v.g}.${gID} = ${v.c}.${gID}`;
		this._priority++;
		if (this._messages.length > 0 && channel == null && user == null) {
			callback(this._messages[this._messages.length - 1]);
			this._con.query(SQL, casheMessages, {from:from, gStr:guildStr}, this);
		} else {
			let channelStr = `${v.m}.${v.ss('cID')} = ${channel}`;
			let userStr = `${v.m}.${v.ss('uID')} = ${user}`;

			if (channel == null && user == null) {
				let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${from} WHERE ${guildStr} ORDER BY DESC ${v.ss('Tim')} LIMIT 1`;
				this._con.query(SQL, returnRes, {func:callback, from:from, gStr:guildStr}, this);
			} else if (channel != null && user != null) {
				let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${from} WHERE ${guildStr} AND ${channelStr} AND ${userStr} ORDER BY DESC ${v.ss('Tim')} LIMIT 1`;
				this._con.query(SQL, returnRes, {func:callback, from:from, gStr:guildStr}, this);
			} else {
				let message = scanCache(this,channel, user)
				if (message == null) {
					if (channel != null) {
						let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${from} WHERE ${guildStr} AND ${channelStr} ORDER BY DESC ${v.ss('Tim')} LIMIT 1`;
					} else {
						let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${from} WHERE ${guildStr} AND ${userStr} ORDER BY DESC ${v.ss('Tim')} LIMIT 1`;
					}
					this._con.query(SQL, returnRes, {func:callback, from:from, gStr:guildStr}, this);
				} else {
					callback(message);
					this._con.query(SQL, casheMessages, {from:from, gStr:guildStr}, this);
				}
			}
		}

		function scanCache (obj, channel = null, user = null) {
			let length = obj._messages.length;
			if (length == 0) {
				return null;
			}
			if (channel == null && user == null) {
				return obj._messages[length - 1];
			}
			for (let i = length - 1; i >= 0; i--) {
				let match = false;
				if (channel) {
					if (String(obj._messages[i].channel.id) == String(channel)) {
						match = true;
					}
				}
				if (user) {
					if (String(obj._messages[i].author.id) == String(user)) {
						match = true;
					}
				}
				if (match) {
					return obj._messages[i];
				}
			}
			return null;
		}

		function returnRes (queryRes, params, obj) {
			callback(queryRes[0][v.ss('mOb')]);
			let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${params.from} WHERE ${params.gStr} ORDER BY DESC ${v.ss('Tim')} LIMIT ${obj.imposedLimit}`;
			obj._con.query(SQL, casheMessages, {}, obj);
		}

		async function casheMessages(queryRes = null , params = {}, obj) {
			if (queryRes != null) {
				obj._messages = [];
				for (let i = queryRes.length - 1; i >= 0; i--) {
					obj._messages.push(queryRes[i][v.ss('mOb')]);
				}
			} else {
				let SQL = `SELECT ${v.m}.${v.ss('mOb')} ${params.from} WHERE ${params.gStr} ORDER BY DESC ${v.ss('Tim')} LIMIT ${obj.imposedLimit}`;
				obj._con.query(SQL, casheMessages, {}, obj);
			}
		}
	}
}