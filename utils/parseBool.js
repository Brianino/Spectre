/**
 * Converts an input into a boolean value
 *
 * @param  {*} input
 * @return {boolean}
*/
module.exports = function parseBool (input) {
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
