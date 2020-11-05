const mod = require('../etc/guildConfig.js');
const {Permissions} = require('discord.js');
const assert = require('assert').strict;
const config = require('../config.json');

describe('Guild Config', function () {
	let guildConfig, testGuild;

	describe('Generic', function () {
		it('should create a new guild config manager object', function () {
			guildConfig = new mod();
			return assert.ok(guildConfig, 'no guild manager object');
		});

		it('should create a new guild object', function () {
			testGuild = guildConfig.getGuildConfig('test');
			return assert.ok(testGuild, 'no test guild object');
		});

		it('can iterate through the properties', function () {
			for (let [prop, val] of testGuild) {
				assert.ok(prop, 'undefined property name was returned');
				assert.ok(val, 'undefined value for ' + prop + ' was returned');
			}
			return true;
		});

		it('can get a list of configurable properties', function () {
			let configurable = guildConfig.getConfigurable();

			assert.ok(configurable, 'nothing returned when requesting configurable options');
			assert.ok(configurable instanceof Map, 'returned value is not a map');
			for (let [prop, [type, desc]] of configurable) {
				assert.ok(prop, 'property name missing');
				assert.ok(type, 'property type missing');
			}
		});

		it('can delete the guild config and the related file');

		after(function () {
			assert.ok(testGuild = guildConfig.getGuildConfig('test'));
		});
	});

	describe('Prefix property', function () {
		it('can check for the property', function () {
			return assert.ok('prefix' in testGuild);
		});

		it('should use the default specified in the config file', function () {
			return assert.equal(testGuild.prefix, config.prefix, 'prefix does not match the one set in the config');
		});

		it('can modify the property', function () {
			let newPrefix = 'prefix';

			testGuild.prefix = newPrefix;

			return assert.equal(testGuild.prefix, newPrefix, 'returned prefix does not equal the set prefix');
		});
	});

	describe('Permissions property', function () {
		it('can check for the property', function () {
			return assert.ok('permissions' in testGuild);
		});

		it('can set a new permission', function () {
			let cmd = 'testcmd';

			testGuild.permissions = [cmd, 1];
			return testGuild.permissions(cmd) instanceof Permissions;
		});

		it('can set multiple permissions', function () {
			let cmd1 = 'testCmd1', cmd2 = 'testCmd2', bit1 = 1, bit2 = 2;

			testGuild.permissions = [cmd1, bit1];
			testGuild.permissions = [cmd2, bit2];

			assert.notEqual(testGuild.permissions(cmd1), testGuild.permissions(cmd2), 'permissions for two commands match');
			assert.equal(testGuild.permissions(cmd1).bitfield, bit1, 'bitfields for the first command don\'t match');
			assert.equal(testGuild.permissions(cmd2).bitfield, bit2, 'bitfields for the second command don\'t match');
			return true;
		});
	});

	describe('Disabled property', function () {
		it('can check for the property', function () {
			return assert.ok('disabled' in testGuild);
		});

		it('can assign a set to the property', function () {
			let dis = new Set(['one', 'two', 'three']);

			testGuild.disabled = dis;

			for (let temp of dis) {
				assert.ok(testGuild.disabled.has(temp), 'missing ' + temp + ' from the disabled set');
			}
			return true;
		});

		it('can assign an array to the property', function () {
			let dis = ['one', 'two', 'three'];

			testGuild.disabled = dis;

			for (let temp of dis) {
				assert.ok(testGuild.disabled.has(temp), 'missing ' + temp + ' from the disabled set');
			}
			return true;
		});
	});

	let baseTypes = [];

	baseTypes.push([String, 'some default', 'test val']);
	baseTypes.push([Number, 100, 20]);
	baseTypes.push([Boolean, false, true]);
	baseTypes.push([Map, new Map([['default', 'test']]), new Map([['test', 'new']])]);
	baseTypes.push([Set, new Set(['default', 'test']), new Set(['test', 'new'])]);
	baseTypes.push([Array, ['default', 'test'], ['test', 'new']]);
	baseTypes.push([Object, {default: 'test'}, {test: 'new'}]);

	for (let [type, defVal, newVal] of baseTypes) {
		let typeName = type.name;
		describe('Custom ' + typeName + ' Property', function () {
			it('can register a new property of type ' + typeName, function () {
				guildConfig.register('test' + typeName, type, {
					default: defVal,
					userEditable: false,
					description: 'A test variable of type ' + typeName,
				});

				return assert.ok(('test' + typeName) in testGuild, 'missing new property in config object');
			});

			it('can register a new property of type ' + typeName + ' without a default', function () {
				guildConfig.register('test2' + typeName, type, {
					userEditable: false,
					description: 'A test variable of type ' + typeName,
				});

				return assert.ok(('test2' + typeName) in testGuild, 'missing new property in config object');
			});

			it('can display the default of type ' + typeName, function () {
				return assert.equal(testGuild['test' + typeName], defVal, 'default value was not returned');
			});

			it('should return undefined for a property with no set default ' + typeName, function () {
				return assert.equal(testGuild['test2' + typeName], undefined, 'received a value instead of undefined');
			});

			it('can modify the new property of type ' + typeName, function () {
				testGuild['test' + typeName] = newVal;
				return assert.equal(testGuild['test' + typeName], newVal, 'property value was not updated');
			});

			it('can modify the new defaultless property of type ' + typeName, function () {
				testGuild['test2' + typeName] = newVal;
				return assert.equal(testGuild['test2' + typeName], newVal, 'property value was not updated');
			});
		});
	}

	describe('Custom Property (Not type specific)', function () {
		let propCount = 0, base = 'test', prop = base + propCount;

		afterEach(function () {
			prop = base + ++propCount;
		});

		it('can set the type as configurable', function () {
			guildConfig.register(prop, String, {
				configurable: true,
			});

			return assert.ok(guildConfig.getConfigurable().get(prop), 'property ' + prop + ' is not showing up in configurable options');
		});

		it('can set the type as non configurable', function () {
			guildConfig.register(prop, String, {
				configurable: false,
			});

			return assert.ok(!guildConfig.getConfigurable().has(prop), 'property ' + prop + ' is showing up in configurable options when it shouldn\'t');
		});

		it('can set the type description', function () {
			let desc = 'A test description';

			guildConfig.register(prop, String, {
				description: desc,
				configurable: true,
			});

			return assert.equal(guildConfig.getConfigurable().get(prop)[1], desc, 'property ' + prop + ' description does not match');
		});

		it('can set a custom setter', function () {
			let testObj = {}, testVal = 'A test value';

			guildConfig.register(prop, Object, {
				default: testObj,
				set (value) {
					this.normal = value;
				}
			});
			guildConfig.register('arrow' + prop, Object, {
				default: testObj,
				set: (value) => {
					testObj.arrow = value;
				}
			});

			testGuild[prop] = testVal;
			testGuild['arrow' + prop] = testVal;

			assert.equal(testObj.arrow, testVal, testVal + ' was not assigned to the object (arrow setter)');
			assert.equal(testObj.normal, testVal, testVal + ' was not assigned to the object (normal setter)');
			assert.equal(testGuild['arrow' + prop].arrow, testVal, testVal + ' was not assigned to the object (arrow setter)');
			assert.equal(testGuild[prop].normal, testVal, testVal + ' was not assigned to the object (normal setter)');
		});

		it('can set a custom getter', function () {
			let testObj = {test: 'First:'}, append = 'Second';

			guildConfig.register(prop, Object, {
				default: testObj,
				get () {
					return this.test + append;
				}
			});

			for (let [key, val] of testGuild) {
				if (key === prop) {
					assert.equal(val, testObj, val + ' is stored instead of ' + testObj);
					break;
				}
			}
			assert.equal(testGuild[prop], testObj.test + append, 'got ' + testGuild[prop] + ' instead of ' + testObj.test + append);
		});

		it('can save properties');

		it('can load properties');

		it('can set custom json converters');

		it('can save properties with custom converters');

		it('can load properties with custom converters');
	});

	after(async function () {
		await guildConfig.deleteGuildConfig('test');
	});
});
