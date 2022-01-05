

import { GuildChannel, GuildMember, Role } from 'discord.js';
import logger from '../core/logger.js';
import split from './split.js';

const log = logger('Utilities');

/**
 * Perform a string matching algorithm on the objects of the source collection
 * @private
 * @memberof utils
 *
 * @param  {Collection}        sourceCollection - the source to scan for a match
 * @param  {string}            value            - the value to search for
 * @param  {string}            type             - the type of matching to perform (partial|full)
 * @param  {(string|function)} prop             - how to objtain the value to match against from the collection object
 * @return {object} the object in the collection that best matches the value according the the search type used
*/
function textSearch (sourceCollection, value, type, prop) {
	value = String(value);
	type = String(type).toLowerCase();
	switch (type) {
		case 'partial': log.debug('Using partial match search, prop:', prop);
			if (typeof prop === 'string')
				return sourceCollection.find(item => String(item[prop]).includes(value));
			else if (typeof prop === 'function')
				return sourceCollection.find(item => String(prop(item)).includes(value));
			else
				return undefined;

		case 'full': log.debug('Using full match search, prop:', prop);
			if (typeof prop === 'string')
				return sourceCollection.find(item => String(item[prop]) === value);
			else if (typeof prop === 'function')
				return sourceCollection.find(item => String(prop(item)) === value);
			else
				return undefined;

		// SMART NOT IMPLEMENTED YET BUT THIS WILL BE A COSTLY SEARCH
		case 'smart': return undefined;
		// if (typeof prop === 'string') return sourceCollection.map(val => calculateScore(val[prop], value)).sort((a, b) => a.score - b.score)[0];
		// else if (typeof prop === 'function') return sourceCollection.map(val => calculateScore(prop(val, value))).sort((a, b) => a.score - b.score)[0];
		// else return undefined;
		// break;
	}

	// function calculateScore (input, value) {}
}

/**
 * Finds the instances of the objects specified in the input string
 * @private
 * @memberof utils
 *
 * @param  {object}
 * @prop   {string}            input           - the input string to search
 * @prop   {Collection}        manager         - the collection of objects to search within
 * @prop   {(string|function)} prop            - how to obtain the value to match against from the collection object
 * @prop   {RegExp}            reg             - the regex to use to check for mentions of this object type
 * @prop   {number}            maxCount        - the maximum number of results to return
 * @prop   {boolean}           resolve         - if true will the function will return objects rather than the id string
 * @prop   {string}            allowText       - the type of string matching to use in the textSearch function
 * @prop   {boolean}           [allowID=false] - allow the searching of id strings
 * @prop   {boolean}           [fetch=true]    - for now this only applies to searching for users
 * @return {(string[]|object[])} list of id strings, or list of objects contained in the manager collection
*/
async function getIDs ({ input, manager, prop, reg, maxCount, resolve, allowText = '', allowID = true, fetch = true }) {
	let temp, res = [], tempReg = new RegExp(reg, 'g');

	if (!input)
		return res;
	else
		input = String(input);
	if (maxCount < 1)
		maxCount = 1;
	log.debug('Searching for mentions:', input);
	while ((temp = tempReg.exec(input)) && res.length < maxCount) {
		log.debug('Found a match:', temp[1], 'using', tempReg.toString(), 'is in guild cache:', manager.cache.has(temp[1]));
		log.debug(temp);
		if (manager.cache.has(temp[1]))
			res.push(resolve ? manager.cache.get(temp[1]) : temp[1]);
	}
	if (res.length)
		return res;

	log.debug(allowID ? 'Searching for id\'s' : 'ID searching disabled');
	if (allowID) {
		while ((temp = /\d{17,19}/g.exec(input)) && res.length < maxCount) {
			log.debug('Found a match:', temp[0], 'is in guild cache:', manager.cache.has(temp[0]));
			log.debug(temp);
			if (manager.cache.has(temp[0])) {
				res.push(resolve ? manager.cache.get(temp[0]) : temp[0]);
			} else if (fetch && Object.hasOwn(manager, 'fetch')) {
				// Currently only the guild user manager has a fetch method
				try {
					const usr = await manager.fetch({ user: temp, limit: maxCount });
					res.push(resolve ? usr : usr.id);
				} catch (e) {
					log.error('Failed to fetch from', manager.constructor.name);
				}
			}
		}
		if (res.length)
			return res;
	}

	log.debug(allowText ? 'Searching for text' : 'Text searching disabled');
	for (const text of split(input)) {
		const found = textSearch(manager.cache, text, allowText, prop);

		if (found) {
			log.debug('Found a match:', found.id, 'is in guild cache:', manager.cache.has(found.id));
			res.push(resolve ? found : found.id);
			if (res.length >= maxCount)
				break;
		} else if (fetch && Object.hasOwn(manager, 'fetch')) {
			// Currently only the guild user manager has a fetch method
			try {
				const usr = await manager.fetch({ query: text, limit: maxCount });
				res.push(resolve ? usr : usr.id);
			} catch (e) {
				log.error('Failed to fetch from', manager.constructor.name);
			}
		}
	}
	return res;
}

const channelReg = /<#(\d{17,19})>/;
/**
 * Gets channel object(s) it finds in the input string
 * @function
 * @memberof utils
 *
 * @param  {(string|GuildChannel)} input           - the message content to search for channel id's
 * @param  {Guild}                 guild           - The guild/scope to search within
 * @param  {object}                [options]
 * @prop   {number}                [maxCount=1]    - the maximum number of results to return, if it is greater than 1 then an array will be returned
 * @prop   {boolean}               [resolve=false] - whether to return the id (false), or the channel object (true)
 * @prop   {boolean}               [allowID=true]  - toggle to allow searching for id strings
 * @prop   {string}                [allowText='']  - setting to partial or full will allow a text matching algorithm for the search
 * @return {(string|string[]|GuildChannel|GuildChannel[])} either a list of channels, or the channel itself
*/
async function getChannelID (input, guild, { maxCount = 1, resolve, ...options } = {}) {
	let manager = guild.channels, res;

	log.debug('Looking for channel, input:', input, 'max', maxCount, 'options', options);
	if (typeof input === 'object' && input instanceof GuildChannel) {
		const temp = resolve ? input : input.id;
		if (manager.cache.has(input.id))
			return maxCount <= 1 ? temp : [temp];
		else
			return maxCount <= 1 ? undefined : [];
	}
	res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: channelReg, prop: 'name' });
	log.debug('Found channel(s):', res.map(val => val.toString()));
	return maxCount > 1 ? res : res[0];
}

const roleReg = /<@&(\d{17,19})>/;
/**
 * Gets role object(s) it finds in the input string
 * @function
 * @memberof utils
 *
 * @param  {(string|Role)} input                   - the message content to search for role id's
 * @param  {Guild}                 guild           - The guild/scope to search within
 * @param  {object}                [options]
 * @prop   {number}                [maxCount=1]    - the maximum number of results to return, if it is greater than 1 then an array will be returned
 * @prop   {boolean}               [resolve=false] - whether to return the id (false), or the role object (true)
 * @prop   {boolean}               [allowID=true]  - toggle to allow searching for id strings
 * @prop   {string}                [allowText='']  - setting to partial or full will allow a text matching algorithm for the search
 * @return {(string|string[]|Role|Role[])} either a list of roles, or the role itself
*/
async function getRoleID (input, guild, { maxCount = 1, resolve, ...options } = {}) {
	let manager = guild.roles, res;

	log.debug('Looking for role, input:', input, 'max', maxCount, 'options', options);
	if (typeof input === 'object' && input instanceof Role) {
		const temp = resolve ? input : input.id;
		if (manager.cache.has(input.id))
			return maxCount <= 1 ? temp : [temp];
		else
			return maxCount <= 1 ? undefined : [];
	}
	res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: roleReg, prop: 'name' });
	log.debug('Found role(s):', res.map(val => val.toString()));
	return maxCount > 1 ? res : res[0];
}

const userReg = /<@!?(\d{17,19})>/;
/**
 * Gets guild members object(s) it finds in the input string
 * @function
 * @memberof utils
 *
 * @param  {(string|GuildMember)} input           - the message content to search for user id's
 * @param  {Guild}                guild           - The guild/scope to search within
 * @param  {object}               [options]
 * @prop   {number}               [maxCount=1]    - the maximum number of results to return, if it is greater than 1 then an array will be returned
 * @prop   {boolean}              [resolve=false] - whether to return the id (false), or the member object (true)
 * @prop   {boolean}              [allowID=true]  - toggle to allow searching for id strings
 * @prop   {string}               [allowText='']  - setting to partial or full will allow a text matching algorithm for the search
 * @prop   {boolean}              [fetch=true]    - when true will fetch from discord if the user isn't in cache
 * @return {(string|string[]|GuildMember)} either a list of guild members, or the member itself
*/
async function getUserID (input, guild, { maxCount = 1, resolve, ...options } = {}) {
	let manager = guild.members, res;

	log.debug('Looking for user, input:', input, 'max', maxCount, 'options', options);
	if (typeof input === 'object' && input instanceof GuildMember) {
		const temp = resolve ? input : input.id;
		if (manager.cache.has(input.id))
			return maxCount <= 1 ? temp : [temp];
		else
			return maxCount <= 1 ? undefined : [];
	}
	res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: userReg, prop: 'displayName' });
	log.debug('Found user(s):', res.map(val => val.toString()));
	return maxCount > 1 ? res : res[0];
}

export { getUserID, getChannelID, getRoleID };
