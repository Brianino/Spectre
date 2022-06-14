import logger from '../core/logger.js';
import split from './split.js';
import {
	GuildChannel,
	GuildMember,
	Role,
	ChannelManager,
	GuildChannelManager,
	GuildMemberManager,
	RoleManager,
} from 'discord.js';

const log = logger('Utilities');

function getFetchMethod (manager, maxCount) {
	let argsMapper = toFetch => [toFetch];
	switch (manager.constructor) {
		case ChannelManager:
			argsMapper = toFetch => [toFetch];
			break;
		case GuildChannelManager:
			argsMapper = toFetch => [toFetch];
			break;
		case GuildMemberManager:
			argsMapper = toFetch => [{ user: toFetch, limit: maxCount }];
			break;
		case RoleManager:
			argsMapper = toFetch => [toFetch];
			break;
	}
	return input => Promise.allSettled(input.map(val => manager.fetch(argsMapper(val))));
}

/**
 * Perform a string matching algorithm on the objects of the source collection
 * @private
 * @memberof utils
 *
 * @param  {Collection}        sourceCollection - the source to scan for a match
 * @param  {string}            value            - the value to search for
 * @param  {string}            type             - the type of matching to perform (partial|full), append _checkcase to make the search case sensative
 * @param  {(string|function)} prop             - how to objtain the value to match against from the collection object
 * @return {object} the object in the collection that best matches the value according the the search type used
*/
function textSearch (sourceCollection, value, type, prop) {
	const getProp = (input) => typeof prop === 'function' ? String(prop(input)) : String(input[String(prop)]);
	let tmp;
	value = String(value);
	type = String(type).toLowerCase();
	switch (type) {
		case 'partial': tmp = (item) => {
			return getProp(item)
				.toLowerCase()
				.includes(value.toLowerCase());
		}; break;
		case 'partial_checkcase': tmp = (item) => getProp(item).includes(value); break;
		case 'full': tmp = (item) => getProp(item).toLowerCase() === value.toLowerCase(); break;
		case 'full_checkcase': tmp = (item) => getProp(item) === value; break;

		// SMART NOT IMPLEMENTED YET BUT THIS WILL BE A COSTLY SEARCH
		case 'smart': return undefined;
		// if (typeof prop === 'string') return sourceCollection.map(val => calculateScore(getProp(val), value)).sort((a, b) => a.score - b.score)[0];
		// break;
	}
	log.debug('Performing check', type);
	return sourceCollection.find(tmp);


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
 * @prop   {Function<?>}       Type            - the type of object to return (this should be the class and not an instance)
 * @prop   {boolean}           [allowID=false] - allow the searching of id strings
 * @prop   {boolean}           [fetch=true]    - for now this only applies to searching for users
 * @return {(string[]|object[])} list of id strings, or list of objects contained in the manager collection
*/
async function getIDs ({ input, manager, prop, reg, maxCount, resolve, Type, allowText = '', allowID = true, fetch = true }) {
	async function handleResult (results, fetchMethod) {
		const toFetch = [], inCache = [];

		results.forEach(val => {
			const tmp = (val instanceof Type) ? val : manager.cache.get(val);
			log.debug(`Found: ${val} (In cache: ${!!tmp})`);
			if (tmp)
				inCache.push(tmp);
			else
				toFetch.push(val);
		});
		log.debug('manager has fetch?', manager.fetch instanceof Function, manager.fetch, 'on', manager.constructor);
		if (fetch && manager.fetch instanceof Function && toFetch.length) {
			// Currently only the guild user manager has a fetch method
			log.debug('Will attempt to fetch', toFetch);
			try {
				const tmp = await fetchMethod(toFetch);
				inCache.push(...tmp.values());
			} catch (e) {
				log.error('Failed to fetch from', manager.constructor.name);
			}
		}
		if (inCache.length > maxCount)
			inCache.length = maxCount;
		if (resolve)
			return inCache;
		else
			return inCache.map(val => val.id);
	}
	function removeResult (result, index) {
		if (!index)
			index = result.indexOf(result);
		if (index < 0)
			return;
		input = input.substring(0, index) + input.substring(index + result.length);
		input = input.trim();
	}

	function regSearch (inputReg) {
		const res = [];
		let temp;

		while ((temp = inputReg.exec(input)) && res.length < maxCount) {
			res.push(temp.length > 1 ? temp[1] : temp[0]);
			removeResult(temp[0], temp.index);
		}
		return handleResult(res, getFetchMethod(manager, maxCount));
	}

	// Setup defaults
	const res = [];
	if (!input)
		return [];
	else if (Array.isArray(input))
		input = [...input].join(' ');
	else
		input = String(input);
	if (maxCount <= 0)
		maxCount = Infinity;

	if (input) {
		log.debug('Searching for mentions');
		const tmp = await regSearch(new RegExp(reg, 'g'));
		res.push(...tmp);
	}

	if (allowID && input) {
		log.debug('Searching for id\'s');
		const tmp = await regSearch(/\d{17,19}/g);
		res.push(...tmp);
	}

	if (allowText && input) {
		log.debug('Searching for text');
		const found = [];
		for (const text of split(input))
			found.push(textSearch(manager.cache, text, allowText, prop));
		const tmp = await handleResult(found.filter(val => val), async (toFetch) => {
			const promises = [], fetched = [];
			for (const tmp of toFetch)
				promises.push(manager.fetch({ query: tmp, limit: maxCount }));
			for (const { status, value, reason } of await promises.allSettled) {
				if (status === 'rejected')
					log.error('Unable to fetch from manager', reason);
				else
					fetched.push(value);
			}
			return fetched;
		});
		res.push(...tmp);
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
	const manager = guild.channels;

	log.debug('Looking for channel, input:', input, 'max', maxCount, 'options', options);
	if (input instanceof GuildChannel) {
		let temp = resolve ? input : input.id;
		if (!manager.cache.has(input.id))
			temp = undefined;
		return maxCount === 1 ? temp : [temp];
	}
	const res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: channelReg, prop: 'name', Type: GuildChannel });
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
	const manager = guild.roles;

	log.debug('Looking for role, input:', input, 'max', maxCount, 'options', options);
	if (input instanceof Role) {
		let temp = resolve ? input : input.id;
		if (!manager.cache.has(input.id))
			temp = undefined;
		return maxCount === 1 ? temp : [temp];
	}
	const res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: roleReg, prop: 'name', Type: Role });
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
	const manager = guild.members;

	log.debug('Looking for user, input:', input, 'max', maxCount, 'options', options);
	if (input instanceof GuildMember) {
		let temp = resolve ? input : input.id;
		if (!manager.cache.has(input.id))
			temp = undefined;
		return maxCount === 1 ? temp : [temp];
	}
	const res = await getIDs({ ...options, input, manager, maxCount, resolve, reg: userReg, prop: 'displayName', Type: GuildMember });
	log.debug('Found user(s):', res.map(val => val.toString()));
	return maxCount > 1 ? res : res[0];
}

export { getUserID, getChannelID, getRoleID };
