'use strict';

const log = require('../utils/logger.js')('Module-Object');
const {Permissions} = require('discord.js');

/*
 * possibly link properties with {@link discord.js#Properties}
*/


/**
 * Object to store the basic properties of a module
 *
 * @param {string} name  - the string used by a user to call the module function
 * @param {string} group - the name for the group of commands this module is part of
*/
class ModuleObject {

	#name;
	#group;
	#objectGroup;
	#description = [];
	#arguments = [];
	#permissions = new Permissions('VIEW_CHANNEL');
	#limitedTo = new Map([['users', new Set()], ['guilds', new Set()]]);

	constructor (name, group) {
		this.#name = name;
		this.#group = group;
	}

	/**
	 * Gets the string used to call the command
	 *
	 * @return {string} the command name
	*/
	get command () {return this.#name}

	/**
	 * Gets the name of the group this module is part of
	 *
	 * @return {string} the group name
	*/
	get group () {return this.#group}

	/**
	 * Sets the name of the shared group.
	 * Modules in this group share the passed global object
	 *
	 * @param {string|Symbol} input - the shared group name
	*/
	set objectGroup (input) {this.#objectGroup = (typeof input === 'symbol')? input : String(input)}

	/**
	 * Gets the name of the shared group.
	 *
	 * @return {string|Symbol} the shared group name
	*/
	get objectGroup () {return this.#objectGroup}

	/**
	 * Sets decription of the module, multiple calls can be made to add more lines
	 * First call should be a quick summary
	 *
	 * @param {string} input - the description of what the module does
	*/
	set description (input) {this.#description.push(String(input))}

	/**
	 * Gets decription of the module
	 *
	 * @return {string[]} the lines of description for the module
	*/
	get description () {return this.#description}

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
	set arguments (input) {this.#arguments.push(String(input))}

	/**
	 * Gets the command usage, multiple calls can be made to add more formats
	 *
	 * @return {string[]} input - the description of what the module does
	*/
	get arguments () {return this.#arguments}

	/**
	 * Sets the default required permission level to run the command
	 *
	 * @param {Permissions} input - what the default required permissions should be
	*/
	set permissions (input) {this.#permissions = new Permissions(input)}

	/**
	 * Gets the default required permission level to run the command
	 *
	 * @return {Permissions} input - the default required permissions
	*/
	get permissions () {return this.#permissions}

	/**
	 * Use to limit the access of the command, or return the set of id's that apply to a limit (if no id's are provided)
	 * e.g. to limit the servers that have access to it, or the users who do
	 * e.g. get the set of server id's that have access to it, or the set of user id's
	 *
	 * @param {string}    type  - the object type this limit applies to, Or the limit type to get
	 * @param {...string} [ids] - the ids of the object type that have access to the command
	*/
	limit (type, ...ids) {
		if (ids.length) {
			if (this.#limitedTo.has(type))
				this.#limitedTo.set(type, new Set(ids));
		} else {
			return new Set(this.#limitedTo.get(type));
		}
	}
}

module.exports = ModuleObject;

module.exports.access = function (user, guild, config) {
	let users = this.limit('users'), guilds = this.limit('guilds');

	if (guild) {
		let gUser = guild.members.cache.get(user.id);

		if (gUser && !gUser.permissions.has(config.permissions(this.command) || this.permissions))
			return false;
		if (guilds.length && guilds.indexOf(guild.id) < 0)
			return false;
		if (config.disabled.has(this.command))
			return false;
	} else {
		if (guilds.length)
			return false;
	}
	log.debug("users", users, "has?", users.has(user.id));
	if (users.size && !users.has(user.id))
		return false;
	return true;
};
