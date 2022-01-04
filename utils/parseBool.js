'use strict';

/**
 * Converts an input into a boolean value
 * @memberof utils
 *
 * @param  {*} input
 * @return {boolean}
*/
function parseBool (input) {
	switch (typeof input) {
		case 'bigint':
		case 'number': return Boolean(input);
		case 'boolean': return input;
		case 'Symbol': return true;
		case 'object': return true;
		case 'null': return false;
		case 'undefined': return false;
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

export default parseBool;
