const emojiController = require('./emojiController.js');

class emojiPageController extends emojiController {

	constructor (options = {}) {
		super(options, new Map([
			['\u23EE\uFE0F', 'first'],
			// left arrow \U2B05\UFE0F
			['\u25C0\uFE0F', 'prev'],
			// left arrow \U27A1\UFE0F
			['\u25B6\uFE0F', 'next'],
			['\u23ED\uFE0F', 'last'],
		]));
	}

	next () {
		this.emit('next');
	}

	prev () {
		this.emit('prev');
	}

	first () {
		this.emit('first');
	}

	lest () {
		this.emit('last');
	}
}

module.exports = class pageController {
	constructor () {throw new Error('cannot initialise directly')};

	static get emoji () {
		return emojiPageController;
	}

	static [Symbol.hasInstance] (instance) {
		return instance instanceof emojiPageController;
	}
}
