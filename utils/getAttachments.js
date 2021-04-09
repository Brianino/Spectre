'use strict';

const log = require('./logger.js')('utilities');

/**
 * @typedef {object}   imageProps
 * @prop    {string}   [name]  - image filename
 * @prop    {string}   url     - the image url
*/

/**
 * Gets the list of image names/urls from the message object
 * @memberof utils
 *
 * @param   {Message}  msg     - the message object to search for attachments
 * @param   {iterable} formats - the list of accepted image formats to include
 * @return  {imageProps[]} a list of imageProps objects
*/
function getAttachments (msg, formats) {
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

module.exports = getAttachments;
