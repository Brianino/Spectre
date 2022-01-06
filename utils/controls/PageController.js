import EmojiController from './EmojiController.js';

class EmojiPageController extends EmojiController {

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

	next (...input) {
		this.emit('next', ...input);
	}

	prev (...input) {
		this.emit('prev', ...input);
	}

	first (...input) {
		this.emit('first', ...input);
	}

	lest (...input) {
		this.emit('last', ...input);
	}
}

class PageController {
	constructor () { throw new Error('cannot initialise directly'); }

	static get Emoji () {
		return EmojiPageController;
	}

	static [Symbol.hasInstance] (instance) {
		return instance instanceof EmojiPageController;
	}
}

export { PageController as default, EmojiPageController };
