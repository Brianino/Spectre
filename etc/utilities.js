const log = require('./logger.js')('utilities');
const {GuildChannel, GuildMember} = require('discord.js');

/** @module utilities */
module.exports = exports;

/**
 * Gets the current time nicely formatted
 *
 * @return {string} the current date formatted in a specific way for logging
*/
exports.time = (function () {
	let formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'GMT',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	return () => {
		return formatter.format(new Date());
	}
})();


exports.split = function (str, filterEmpty = true) {
	let groups = str.split('"'), res = [];

	groups.forEach((val, i) => {
		if (i % 2 === 0)
			res = res.concat(val.split(' ').filter(val => val !== ''));
		else res.push(val);
	});

	if (filterEmpty) res = res.filter(val => val !== '');
	return res;
}

/**
 * Converts an input into a boolean value
 *
 * @param  {*} input
 * @return {boolean}
*/
exports.parseBool = function (input) {
	switch (typeof input) {
		case 'bigint':
		case 'number': return Boolean(input); break;
		case 'boolean': return input; break;
		case 'Symbol': return true; break;
		case 'object': return true; break;
		case 'null': return false; break;
		case 'undefined': return false; break;
		case 'string':
		switch (input.toLowerCase()) {
			case '':
			case 'f':
			case 'false': return false;

			default:
			case 't':
			case 'true': return true;
		}
	}
}

/**
 * Perform a string matching algorithm on the objects of the source collection
 * @private
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
		if (typeof prop === 'string') return sourceCollection.find(item => String(item[prop]).includes(value));
		else if (typeof prop === 'function') return sourceCollection.find(item => String(prop(item)).includes(value));
		else return undefined;
		break;

		case 'full': log.debug('Using full match search, prop:', prop);
		if (typeof prop === 'string') return sourceCollection.find(item => String(item[prop]) === value);
		else if (typeof prop === 'function') return sourceCollection.find(item => String(prop(item)) === value);
		else return undefined;
		break;

		// SMART NOT IMPLEMENTED YET BUT THIS WILL BE A COSTLY SEARCH
		case 'smart': return undefined;
		if (typeof prop === 'string') return sourceCollection.map(val => calculateScore(val[prop], value)).sort((a, b) => a.score - b.score)[0];
		else if (typeof prop === 'function') return sourceCollection.map(val => calculateScore(prop(val, value))).sort((a, b) => a.score - b.score)[0];
		else return undefined;
		break;
	}

	function calculateScore (input, value) {}
}

/**
 * Finds the instances of the objects specified in the input string
 * @private
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
 * @return {(string[]|object[])} list of id strings, or list of objects contained in the manager collection
*/
function getIDs ({input, manager, prop, reg, maxCount, resolve, allowText = '', allowID = true}) {
	let temp, res = [], tempReg = new RegExp(reg, 'g');

	if (maxCount < 1) maxCount = 1;

	input = String(input);

	log.debug('Searching for mentions:', input);
	while ((temp = tempReg.exec(input)) && res.length < maxCount) {
		log.debug('Found a match:', temp[1], 'is in guild:', manager.has(temp[1]));
		log.debug(temp);
		if (manager.has(temp[1]))
			res.push(resolve? manager.get(temp[1]) : temp[1]);
	}
	if (res.length) return res;

	log.debug(allowID? 'Searching for id\'s' : 'ID searching disabled');
	while ((temp = /\d{17,19}/g.exec(input)) && res.length < maxCount && allowID) {
		log.debug('Found a match:', temp[0], 'is in guild:', manager.has(temp[0]));
		log.debug(temp);
		if (manager.has(temp[0]))
			res.push(resolve? manager.get(temp[0]) : temp[0]);
	}
	if (res.length) return res;

	log.debug(allowText? 'Searching for text' : 'Text searching disabled');
	for (let text of exports.split(input)) {
		let found = textSearch(manager, text, allowText, prop);

		if (found) {
			log.debug('Found a match:', found.id, 'is in guild:', manager.has(found.id));
			res.push(resolve? found : found.id);
			if (res.length >= maxCount) break;
		}
	}
	return res;
}

/**
 * Gets channel object(s) it finds in the input string
 *
 * @param  {(string|GuildChannel)} input           - the message content to search for user id's
 * @param  {Guild}                 guild           - The guild/scope to search within
 * @param  {object}                [options]
 * @prop   {number}                [maxCount=1]    - the maximum number of results to return, if it is greater than 1 then an array will be returned
 * @prop   {boolean}               [resolve=false] - whether to return the id, or the channel object
 * @prop   {boolean}               [allowID=true]  - toggle to allow searching for id strings
 * @prop   {string}                [allowText='']  - setting to partial or full will allow a text matching algorithm for the search
 * @return ({string|string[]|GuildChannel|GuildChannel[])} either a list of channels, or the channel itself
*/
const channelReg = /<#(\d{17,19})>/;
exports.getChannelID = function (input, guild, {maxCount = 1, ...options} = {resolve = false}) {
	let reg = channelReg, manager = guild.channels.cache, prop = 'name', res;

	log.debug('Looking for channel, input:', input, 'max', maxCount, 'options', options);
	if (typeof input === 'object' && input instanceof GuildChannel) {
		let temp = options.resolve? input : input.id;
		if (manager.has(input.id))
			return maxCount <= 1 ? temp : [temp];
		else
			return maxCount <= 1 ? undefined : [];
	}
	res = getIDs(Object.assign({}, options, {input, manager, prop, reg, maxCount}));
	log.debug('Found channel(s):', res);
	return maxCount > 1? res : res[0];
}


/**
 * Gets guild members object(s) it finds in the input string
 *
 * @param  {(string|GuildMember)} input           - the message content to search for user id's
 * @param  {Guild}                guild           - The guild/scope to search within
 * @param  {object}               [options]
 * @prop   {number}               [maxCount=1]    - the maximum number of results to return, if it is greater than 1 then an array will be returned
 * @prop   {boolean}              [resolve=false] - whether to return the id, or the member object
 * @prop   {boolean}              [allowID=true]  - toggle to allow searching for id strings
 * @prop   {string}               [allowText='']  - setting to partial or full will allow a text matching algorithm for the search
 * @return {(string|string[]|GuildMember)} either a list of guild members, or the member itself
*/
const userReg = /<@!?(\d{17,19})>/;
// Refer to the getIDs function to find out what the options should be
exports.getUserID = function (input, guild, {maxCount = 1, ...options} = {resolve = false}) {
	let reg = channelReg, manager = guild.members.cache, prop = 'displayName', res;

	log.debug('Looking for user, input:', input, 'max', maxCount, 'options', options);
	if (typeof input === 'object' && input instanceof GuildMember) {
		let temp = options.resolve? input : input.id;
		if (manager.has(input.id))
			return maxCount <= 1 ? temp : [temp];
		else
			return maxCount <= 1 ? undefined : [];
	}
	res = getIDs(Object.assign({}, options, {input, manager, prop, reg, maxCount}));
	log.debug('Found user(s):', res);
	return maxCount > 1? res : res[0];
}

/**
 * @typedef {object}   imageProps
 * @prop    {string}   [name]  - image filename
 * @prop    {string}   url     - the image url
*/

/**
 * Gets the list of image names/urls from the message object
 *
 * @param   {Message}  msg     - the message object to search for attachments
 * @param   {iterable} formats - the list of accepted image formats to include
 * @return  {imageProps[]} a list of imageProps objects
*/

exports.getAttachments = function (msg, formats) {
	let res = [], aformats = Array.from(formats);
	for (let attachment of msg.attachments.values()) {
		let name = attachment.name, url = attachment.url, temp = name.split('.').pop();

		if (aformats.find(val => val === temp)) res.push({name, url});
	}
	for (let embed of msg.embeds) {
		if (embed.type === 'image' || embed.type === 'gifv') {
			try {
				let url = embed.url, name = new URL(url).pathname.split('/').pop(), temp = name.split('.').pop();

				if (aformats.find(val => val === temp)) res.push({name, url});
				else res.push({url});
			} catch (e) {
				log.warn(exports.time(), 'Unable to parse url embed:', e.message);
				log.warn('url is:', embed.url);
			}
		}
	}
	return res;
}


/**
 * Scans the input text for urls, and returns the matches
 *
 * @param  {string}            text      - the input text to search for urls
 * @param  {boolean}           geMatches - if set to true, returns the matching url string
 * @param  {string}            flags     - the regex flags to use when getting matches
 * @return {(boolean|Array[])} returns either the list of matching regex results, or a boolean value
*/
const urlReg = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
exports.checkForUrl = function (text, getMatches = false, flags = '') {
	if (!getMatches) {
		return urlReg.test(text);
	} else {
		let treg = urlReg, res = [];

		if (flags) treg = new RegExp(urlReg, String(flags));

		if (treg.global || treg.sticky) {
			let temp;
			while (temp = treg.exec(text)) {
				res.push(temp);
			}
			return res;
		} else {
			return treg.exec(text);
		}
	}
}


/**
 * A timeout function to wait for a certain condition
 *
 * @param  {number}   time      - the amount of total time to wait for
 * @param  {number}   interval  - the interval at which to run the check function
 * @param  {function} checkFunc - the function to run to check if the wait has succeeded, should return a truthy value
 * @return {Promise} a promise that resolves when the check function succeeds, otherwise it will reject
*/
exports.waitFor = function (time = 1000, interval = 10, checkFunc) {
	interval =  Number(interval);
	if (isNaN(interval) || interval === 0) interval = 10;
	return new Promise((resolve, reject) => {
		let func = async (passed, tFunc) => {
			let newTime = interval + passed - time;
			try {
				if (await tFunc()) return resolve(true);
				else if (newTime > 0) {
					interval -= newTime;
					if (interval <= 0) return resolve(false);
				}
				setTimeout(func, interval, passed + interval, tFunc);
			} catch (e) {
				return reject(e);
			}
		}
		if (interval && typeof checkFunc === 'function') {
			setTimeout(func, interval, interval, checkFunc);
		} else {
			setTimeout(func, time, time, () => true);
		}
	})
}
