"use strict";
const mysql = require('mysql');
const color = require('colors');

class connection {
	constructor (chost = null, cuser = null, cpass = null) {
		let temp = {
			host: chost,
			user: cuser,
		}
		if (cpass != null && cpass != '') {
			temp.pass = cpass;
		}
		this._host = chost;
		this._user = cuser;
		this._pass = cpass;
		this._con =  mysql.createConnection(temp);
		this._instantiated = false;
		this.connect();
	}

	connect (callback = function () {}, params = {}) {
		let h = this._host, u = this._user;
		console.log(`Attempting to connect to ${String(this._host)}`);
		this._con.connect(function (e) {
			if (e) {
				console.log(`Error occured during database connection`);
				console.log(e.red);
				try {
					callback(e, params);
				} catch (err) {};
			} else {
				console.log(`Connected to ${h.green} as ${u.green}`);
			}
		});
	}

	get con () {
		// AVOID USING THIS METHOD IF POSSIBLE
		return this._con;
	}

	get state () {
		return this._con.state;
	}

	query (sql = "", callback = function () {}, params = {}, objInstance = {}) {
		if (sql != "") {
			this._con.query(sql, function (e, result) {
				//console.log(result);
				if (e) {
					params.error = true;
					console.log(`Query Error`);
					console.log(`Query: ${sql.red}`);
					console.log(`Error: ${e}`);
					try {
						if (objInstance == {} ) {
							callback([], params);
						} else {
							callback([], params, objInstance);
						}
					} catch (err) {
						console.log(err);
					};
				} else {
					try {
						if (objInstance == {} ) {
							callback(result, params);
						} else {
							callback(result, params, objInstance);
						}
					} catch (err) {
						console.log(err);
					};
				}
			})
		} else {
			throw {
				name: "sql string error",
				message: "sql string is empty, connection.js"
			}
		}
	}

	queryEsc (sql = "", vals = [], callback = null) {
		if (sql != "") {
			if (typeof(vals) == 'array') {
				this._con.query(sql, vals, function (e, result) {
					//console.log(result);
					if (e) {
						if (callback == null) {
							console.log(`Query Error`);
							console.log(`Query: ${sql.red}`);
							console.log(`Error: ${e}`);
						} else {
							try {
								callback(e);
							} catch (err) {
								console.log(err);
							};
						}
					} else {
						try {
							if (callback != null) {
								callback(result, params);
							}
						} catch (err) {
							console.log(err);
						};
					}
				})
			} else {
				throw {
					name: "sql values error",
					message: "sql values not passed in an array"
				}
			}
		} else {
			throw {
				name: "sql string error",
				message: "sql string is empty, connection.js"
			}
		}
	}

	esc (input) {
		return this._con.escape(input);
	}

	set instantiated (input) {
		if (input) {
			this._instantiated = true;
		} else {
			console.log(`Something attempted to set instantiated to ${input}`);
		}
	}

	get instantiated () {
		return this._instantiated;
	}

	shut (callback = function () {}) {
		con.end(function (e) {
			try {
				callback(e);
			} catch (err) {};
		})
	}
}

module.exports = connection;