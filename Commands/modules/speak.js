"use strict";
const color = require('colors');

module.exports = (function () {
	return function speak (message = {}) {
		let input = '', arr = String(message.content).split(" ");
		let mention = /<@[0-9]*>/;

		if (mention.test(arr[0])) {
			arr.splice(0,2);
		} else {
			arr.splice(0,1);
		}
		input = arr.join(" ");
		message.reply(input);
	}
})();