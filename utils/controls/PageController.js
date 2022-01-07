import EmojiController from './EmojiController.js';

class EmojiPageController extends EmojiController {

	constructor (options = {}) {
		super(options, new Map([
			['first', '\u23EE\uFE0F'],
			// left arrow \U2B05\UFE0F
			['prev', '\u25C0\uFE0F'],
			// left arrow \U27A1\UFE0F
			['next', '\u25B6\uFE0F'],
			['last', '\u23ED\uFE0F'],
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
