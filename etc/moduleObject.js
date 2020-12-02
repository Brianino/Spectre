'use strict';

const log = require('./logger.js')('module-object');
const {Permissions} = require('discord.js');
const sym = {
	name: Symbol('command name'),
	mgrp: Symbol('command mgrp'),
	ogrp: Symbol('command ogrp'),
	desc: Symbol('command desc'),
	args: Symbol('command args'),
	conf: Symbol('command conf'),
	perm: Symbol('command perm'),
	clim: Symbol('command clim'),
	ctxg: Symbol('comm srv ctx'),
	ctxu: Symbol('comm usr ctx'),
	ctxf: Symbol('ctx type def'),
}

/*
 * possibly link properties with {@link discord.js#Properties}
*/


/**
 * Object to store the basic properties of a module
 *
 * @param {string} name  - the string used by a user to call the module function
 * @param {string} group - the name for the group of commands this module is part of
*/
module.exports = class module {
	constructor (name, group) {
		Object.defineProperties(this, {
			[sym.name]: {value: name},
			[sym.mgrp]: {value: group},
			[sym.ogrp]: {writable: true, value: null},
			[sym.ctxg]: {writable: true, value: null},
			[sym.ctxu]: {writable: true, value: null},
			[sym.ctxf]: {writable: true, value: 0},
			[sym.desc]: {writable: true, value: []},
			[sym.args]: {writable: true, value: []},
			[sym.conf]: {writable: true, value: []},
			[sym.perm]: {writable: true, value: new Permissions('VIEW_CHANNEL')},
			[sym.clim]: {value: new Map([['users', new Set()], ['guilds', new Set()]])},
		});
	}

	/**
	 * Gets the string used to call the command
	 *
	 * @return {string} the command name
	*/
	get command () {return this[sym.name]}

	/**
	 * Gets the name of the group this module is part of
	 *
	 * @return {string} the group name
	*/
	get group () {return this[sym.mgrp]}

	/**
	 * Sets the name of the shared group.
	 * Modules in this group share the passed global object
	 *
	 * @param {string} input - the shared group name
	*/
	set objectGroup (input) {this[sym.ogrp] = (typeof input === 'symbol')? input : String(input)}

	/**
	 * Gets the name of the shared group.
	 *
	 * @return {string} the shared group name
	*/
	get objectGroup () {return this[sym.ogrp]}

	/**
	 * Sets decription of the module, multiple calls can be made to add more lines
	 * First call should be a quick summary
	 *
	 * @param {string} input - the description of what the module does
	*/
	set description (input) {this[sym.desc].push(String(input))}

	/**
	 * Gets decription of the module
	 *
	 * @return {string[]} the lines of description for the module
	*/
	get description () {return this[sym.desc]}

	/**
	 * Sets the command usage, multiple calls can be made to add more formats
	 * the format should follow:
	 *   <param>    - for required parameters (mast have one)
	 *   [param]    - for optional parameters (0 or 1)
	 *   <...param> - for at least one required (1 or more)
	 *   [...param] - for any number (0 or more)
	 *   param      - for fixed values (exactly the string specified)
	 *
	 * @param {string} input - the description of what the module does
	*/
	set arguments (input) {this[sym.args].push(String(input))}

	/**
	 * Gets the command usage, multiple calls can be made to add more formats
	 *
	 * @return {string[]} input - the description of what the module does
	*/
	get arguments () {return this[sym.args]}

	/**
	 * Sets the default required permission level to run the command
	 *
	 * @param {Permissions} input - what the default required permissions should be
	*/
	set permissions (input) {this[sym.perm] = new Permissions(input)}

	/**
	 * Use to limit the access of the command
	 * e.g. to limit the servers that have access to it, or the users who do
	 *
	 * @param {string}    type  - the object type this limit applies to
	 * @param {...string} [ids] - the ids of the object type that have access to the command
	*/
	limit (type, ...ids) {
		if (this[sym.clim].has(type)) this[sym.clim].set(type, new Set(ids));
	}
}

module.exports.access = function (user, guild, config) {
	let users = this[sym.clim].get('users'), guilds = this[sym.clim].get('guilds');

	if (guild) {
		let gUser = guild.members.cache.get(user.id);

		if (gUser && !gUser.permissions.has(config.permissions(this.command) || this[sym.perm]))
			return false;
		if (guilds.length && guilds.indexOf(guild.id) < 0)
			return false;
		if (config.disabled.has(this.command))
			return false;
	} else {
		if (guilds.length)
			return false;
	}
	if (users.length && users.indexOf(user.id) < 0)
		return false;
	return true;
};
