"use strict";
//OBJECT FOR MANAGING GUILDS
const config = require('./../config.js');
const guild = require('./guildObj');
const v = require('./dbVarTypes.js');

class guildManager {
	constructor (con, client) {
		this._con = con;
		this._client = client;
		this._guilds = {};
		createGuilds(this, con, client);
		this._client.on('guildCreate', function (input) {
			this._guilds[input.id] = new guild (this._con)
		})

		function createGuilds (obj, con, bot) {
			let guilds = bot.guilds.array();

			for (let i = 0; i < guilds.length; i++) {
				if (!(guilds.id in obj._guilds)) {
					obj._guilds[guilds.id] = new guild(con, guilds.id, bot);
				}
			}
		}

		async function setLimits() {
			//this function should run periodically to set the cashed message limits for each server
			//prioritise higher usage servers
		}
	}

	getGuild (id) {
		if (!(msg.guild.id in this._guilds)) {
			this._guilds[guilds.id] = new guild(con, guilds.id, bot);
		}
		return this._guilds[id];
	}

	archiveMessage (msg, editFrom = {}) {
		if (!(msg.guild.id in this._guilds)) {
			this._guilds[guilds.id] = new guild(con, guilds.id, bot);
		}
		return this._guilds[msg.guild.id].archiveMessage(msg, editFrom);
	}

	//timed manage guild
}