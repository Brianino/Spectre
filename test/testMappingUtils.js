const map = require('../etc/mappingUtils.js');
const {Permissions} = require('discord.js');
const assert = require('assert').strict;

function objmap(obj, func) {
	let res = [];
	if (obj.constructor.name === 'Object') {
		for (let key in obj)
			res.push(func(key, obj[key]));
		return res;
	} else {
		throw Error('Simple object wasn\'t passed to the object map');
	}
}

describe('Mapping Utils', function () {
	let types = [], mFunc = (key, val) => [key, map.auto.toJson(val)];

	// Primative test data (symbols and undefined primatives are not supported)
	types.push({type: 'string', value: 'some test string', converted: 'some test string'});
	types.push({type: 'number', value: 10, converted: 10});
	types.push({type: 'boolean', value: true, converted: true, label: 'boolean true'});
	types.push({type: 'boolean', value: false, converted: false, label: 'boolean false'});
	//types.push({type: 'bigint', value: 9007199254740992n, converted: "9007199254740992"})

	// Simple objects test data
	types.push({type: 'object', value: {a: 1, b: 2}, converted: {a: {type: 'number', value: 1}, b: {type: 'number', value: 2}}});
	types.push({type: 'array', value: [1, 2], converted: [1, 2].map(val => map.auto.toJson(val)), label: 'array of numbers'});
	types.push({type: 'array', value: ['one', 'two'], converted: ['one', 'two'].map(val => map.auto.toJson(val)), label: 'array of strings'});
	types.push({type: 'array', value: [1, 'two', true], converted: [1, 'two', true].map(val => map.auto.toJson(val)), label: 'array of multiple types'});

	// Map object test data
	types.push({type: 'map', value: new Map([['key1', 'val1'], ['key2', 'val2']]), converted: objmap({key1: 'val1', key2: 'val2'}, mFunc), label: 'map of strings'});
	types.push({type: 'map', value: new Map([['key1', 1], ['key2', 2]]), converted: objmap({key1: 1, key2: 2}, mFunc), label: 'map of numbers'});
	types.push({type: 'map', value: new Map([['key1', {p1: 1, p2: 2}], ['key2', {t1: 1, t2: 2}]]), converted: objmap({key1: {p1: 1, p2: 2}, key2: {t1: 1, t2: 2}}, mFunc), label: 'map of objects'});

	// Set object test data
	types.push({type: 'set', value: new Set(['val1', 'val2']), converted: ['val1', 'val2'].map(val => map.auto.toJson(val)), label: 'set of strings'});
	types.push({type: 'set', value: new Set([1, 2]), converted: [1, 2].map(val => map.auto.toJson(val)), label: 'set of numbers'});
	types.push({type: 'set', value: new Set([{p1: 1, p2: 2}, {t1: 1, t2: 2}]), converted: [{p1: 1, p2: 2}, {t1: 1, t2: 2}].map(val => map.auto.toJson(val)), label: 'set of objects'});

	// Other objects test data
	types.push({type: 'permissions', value: new Permissions(164002), converted: 164002, label: 'permissions with int input'});
	types.push({type: 'permissions', value: new Permissions(['VIEW_AUDIT_LOG', 'MANAGE_GUILD', 'KICK_MEMBERS', 'ATTACH_FILES', 'MENTION_EVERYONE']), converted: 164002, label: 'permissions with flag input'});

	for (let {type, value, converted, label} of types) {
		describe('Mapping Type ' + (label || type), function () {
			it('should convert the value to a json friendly value', function () {
				assert.deepEqual(map[type].toJson(value), converted, 'value was not converted properly');
			});

			it('should convert from the json friendly value back to the original value type', function () {
				let asObj = map[type].from(converted);

				assert.equal(asObj.constructor.name, value.constructor.name);
				assert.deepEqual(map[type].toJson(asObj), converted);
			});

			it('should stringify the value properly', function () {
				assert.equal(map.asString(type, value), JSON.stringify(converted));
			});

			it('should parse a string value properly', function () {
				let asObj = map.asObject(type, JSON.stringify(converted));

				assert.equal(asObj.constructor.name, value.constructor.name);
				assert.deepEqual(map[type].toJson(asObj), converted);
			});

			it('should be able to get the converter method for the type', function () {
				let conv = map.getConverter(type);
				assert.ok(conv);
				assert.equal(typeof conv, 'object');
				assert.ok(conv.toJson);
				assert.ok(conv.from);
			});

			it('can use the auto method to produce a json friendly object', function () {
				assert.deepEqual(map.auto.toJson(value), {type: type, value: converted});
			});

			it('should handle compound values properly', function () {
				let set = new Set([value]);

				assert.deepEqual(map.set.toJson(set), [{type: type, value: converted}]);
			});
		});
	}
});
