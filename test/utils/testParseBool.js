const parseBool = require('../../utils/parseBool.js');
const assert = require('assert').strict;

describe('Parse Bool', function () {
	describe('String into boolean', function () {
		it('should convert "true" into true', function () {
			assert.equal(parseBool('true'), true);
			assert.equal(parseBool('t'), true);
			assert.equal(parseBool('ok'), true);
		});

		it('should convert "false" in false', function () {
			assert.equal(parseBool('false'), false);
			assert.equal(parseBool('f'), false);
			assert.equal(parseBool(''), false);
		});
	})
});
