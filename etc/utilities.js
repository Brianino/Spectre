const log = require('debug-logger')('utilities');
const URL = require('url');

module.exports = exports;


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


exports.getChannelID = function (input, guild) {
	let channelReg = /<#(\d{17,19})>/, temp;

	if (typeof input === 'string') {
		if (temp = /<#(\d{17,19})>/.exec(input)) {
			return temp[1];
		} else if (temp = /\d{17,19}/) {
			return temp;
		} else {
			temp = guild.channels.cache.find(channel => (channel.name.indexOf(input) > 1) && channel.type === 'text');
			if (temp) return temp.id;
		}

		throw new Error('unable to find channel ' + input);
	} else if (input instanceof GuildChannel) {
		return input.id;
	}
	throw new Error('unknown channel input type ' + typeof input);
}


exports.getAttachments = function (msg, formats) {
	let res = [], aformats = Array.from(formats);
	for (let attachment of msg.attachments.values()) {
		let name = attachment.name, url = attachment.url, temp = name.split('.').pop();

		log.debug('Found attachment', name, 'type', temp, aformats.find(val => val === temp));
		if (aformats.find(val => val === temp)) res.push({name, url});
	}
	for (let embed of msg.embeds) {
		log.debug('embed type', embed.type);
		if (embed.type === 'image') {
			try {
				let url = embed.url, name = new URL(url).pathname.split('/').pop(),
					temp = name.split('.').pop();

				log.debug('Found image embed', name, 'type', temp, aformats.find(val => val === temp));
				if (aformats.find(val => val === temp)) res.push({name, url});
			} catch (e) {
				log.warn(exports.time(), 'Unable to parse url embed:', e.message);
				log.warn('url is:', embed.url);
			}
		}
	}
	log.debug('Found', res.length, 'attachments in message from', msg.author.username);
	return res;
}
