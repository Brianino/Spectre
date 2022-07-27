import { promises as fs, readFileSync } from 'fs';
import { Permissions } from 'discord.js';
import GuildConfig from '../core/GuildConfig.js';
import waitFor from '../utils/waitFor.js';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';
import Path from 'path';

const config = JSON.parse(readFileSync('./config.json')),
	__dirname = Path.resolve(fileURLToPath(import.meta.url), '../');

describe('Guild Config', function () {
	let guildConfig, testGuild;

	beforeEach(function () {
		guildConfig = new GuildConfig();
		testGuild = guildConfig.getGuildConfig('test');
	});

	after(function () {
		guildConfig.deleteGuildConfig('test');
	});

	describe('Generic', function () {
		const savedValue = 'new';

		it('should create a new guild config manager object', function () {
			guildConfig = new GuildConfig();
			return assert.ok(guildConfig, 'no guild manager object');
		});

		it('should create a new guild object', function () {
			testGuild = guildConfig.getGuildConfig('test');
			return assert.ok(testGuild, 'no test guild object');
		});

		it('can iterate through the properties', function () {
			for (const [prop, val] of testGuild) {
				assert.ok(prop, 'undefined property name was returned');
				assert.ok(val, `undefined value for ${prop} was returned`);
			}
			return true;
		});

		it('can get a list of configurable properties', function () {
			const configurable = guildConfig.getConfigurable();

			assert.ok(configurable, 'nothing returned when requesting configurable options');
			assert.ok(configurable instanceof Map, 'returned value is not a map');
			for (const [prop, [type]] of configurable) {
				assert.ok(prop, 'property name missing');
				assert.ok(type, 'property type missing');
			}
		});

		it('can save properties', async function () {
			const guild = guildConfig.getGuildConfig('savetest');
			let file;

			guild.prefix = savedValue;
			await waitFor(undefined, undefined, async () => {
				try {
					file = await fs.readFile(Path.resolve(__dirname, '../data/savetest.json'), 'utf8');
					if (file.length === 0)
						throw new Error('File empty');
					return true;
				} catch (e) {
					return false;
				}
			});
			assert.equal(JSON.parse(file).prefix, savedValue);
		});

		it('can load properties', async function () {
			const tempConfig = new GuildConfig();

			await tempConfig.loadConfig();
			const guild = tempConfig.getGuildConfig('savetest');

			assert.equal(guild.prefix, savedValue);
		});

		it('can delete the guild config and the related file', async function () {
			await guildConfig.deleteGuildConfig('savetest');
			assert.rejects(await fs.access(Path.resolve(__dirname, '../data/savetest.json')));
		});

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
			const newPrefix = 'prefix';

			testGuild.prefix = newPrefix;

			return assert.equal(testGuild.prefix, newPrefix, 'returned prefix does not equal the set prefix');
		});
	});

	describe('Permissions property', function () {
		it('can check for the property', function () {
			return assert.ok('permissions' in testGuild);
		});

		it('can set a new permission', function () {
			const cmd = 'testcmd';

			testGuild.permissions = [cmd, 1];
			return testGuild.permissions(cmd) instanceof Permissions;
		});

		it('can set multiple permissions', function () {
			const cmd1 = 'testCmd1', cmd2 = 'testCmd2', bit1 = 1n, bit2 = 2n;

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
			const dis = new Set(['one', 'two', 'three']);

			testGuild.disabled = dis;

			for (const temp of dis)
				assert.ok(testGuild.disabled.has(temp), `missing ${temp} from the disabled set`);

			return true;
		});

		it('can assign an array to the property', function () {
			const dis = ['one', 'two', 'three'];

			testGuild.disabled = dis;

			for (const temp of dis)
				assert.ok(testGuild.disabled.has(temp), `missing ${temp} from the disabled set`);

			return true;
		});
	});

	const baseTypes = [];
	// eslint-disable-next-line one-var
	let count = 0;

	baseTypes.push([String, 'some default', 'test val', 'updated val']);
	baseTypes.push([Number, 100, 20, 30]);
	baseTypes.push([Boolean, false, true, false]);
	baseTypes.push([Boolean, true, false, true]);
	baseTypes.push([Map, new Map([['default', 'test']]), new Map([['test', 'new']]), new Map([['updated', 'test']])]);
	baseTypes.push([Set, new Set(['default', 'test']), new Set(['test', 'new']), new Set(['updated', 'test'])]);
	baseTypes.push([Array, ['default', 'test'], ['test', 'new'], ['updated', 'test']]);
	baseTypes.push([Object, { default: 'test' }, { test: 'new' }, { updated: 'test' }]);

	for (const [type, defVal, newVal, otherVal] of baseTypes) {
		const typeName = type.name, prop = `${count++}test${typeName}`, prop2 = `${prop}2`;

		describe(`Custom ${typeName} Property`, function () {
			beforeEach(function () {
				guildConfig.register(prop, type, {
					default: defVal,
					userEditable: false,
					description: `A test variable of type ${typeName}`,
				});
				guildConfig.register(prop2, type, {
					userEditable: false,
					description: `A test variable of type ${typeName}`,
				});
			});

			it(`can register a new property of type ${typeName}`, function () {
				return assert.ok(prop in testGuild, 'missing new property in config object');
			});

			it(`can register a new property of type ${typeName} without a default`, function () {
				return assert.ok(prop2 in testGuild, 'missing new property in config object');
			});

			it('can display the default', function () {
				return assert.equal(testGuild[prop], defVal);
			});

			it('should return undefined when there is no default', function () {
				return assert.equal(testGuild[prop2], undefined);
			});

			it('can set the first value', function () {
				testGuild[prop] = newVal;
				return assert.equal(testGuild[prop], newVal);
			});

			it('can set the first value when there is no default', function () {
				testGuild[prop2] = newVal;
				return assert.equal(testGuild[prop2], newVal);
			});

			it('can modify the value', function () {
				testGuild[prop] = otherVal;
				return assert.equal(testGuild[prop], otherVal);
			});

			it('can modify the value when there is no default', function () {
				testGuild[prop2] = otherVal;
				return assert.equal(testGuild[prop2], otherVal);
			});

			it('can revert to the default', function () {
				testGuild[prop] = undefined;
				return assert.equal(testGuild[prop], defVal);
			});

			it('can revert to undefined', function () {
				testGuild[prop2] = undefined;
				return assert.equal(testGuild[prop2], undefined);
			});

			if (typeof defVal !== 'object') {
				it('can use a custom setter (primitive)');

				it('can use a custom getter (primitive)');
			}
		});
	}

	describe('Custom Property (Not type specific)', function () {

		it('can set the type as configurable', function () {
			const prop = 'test_configurable';
			guildConfig.register(prop, String, { configurable: true });

			return assert.ok(guildConfig.getConfigurable().get(prop), `property ${prop} is not showing up in configurable options`);
		});

		it('can set the type as non configurable', function () {
			const prop = 'test_non_configurable';
			guildConfig.register(prop, String, { configurable: false });

			return assert.ok(!guildConfig.getConfigurable().has(prop), `property ${prop} is showing up in configurable options when it shouldn't`);
		});

		it('can set the type description', function () {
			const prop = 'test_description', desc = 'A test description';

			guildConfig.register(prop, String, {
				description: desc,
				configurable: true,
			});

			return assert.equal(guildConfig.getConfigurable().get(prop)[1], desc, `property ${prop} description does not match`);
		});

		it('can set a custom setter (object)', function () {
			const prop = 'test_setter', testObj = {}, testVal = 'A test value';

			guildConfig.register(prop, Object, {
				default: testObj,
				set (value) {
					this.normal = value;
				},
			});
			guildConfig.register(`arrow${prop}`, Object, {
				default: testObj,
				set: (value) => {
					testObj.arrow = value;
				},
			});

			testGuild[prop] = testVal;
			testGuild[`arrow${prop}`] = testVal;

			assert.equal(testObj.arrow, testVal, `${testVal} was not assigned to the object (arrow setter)`);
			assert.notEqual(testObj.normal, testVal, `${testVal} should not assigned to the object but was (normal setter)`);
			assert.notEqual(testGuild[`arrow${prop}`].arrow, testVal, `${testVal} should not assigned to the object but was (arrow setter)`);
			assert.equal(testGuild[prop].normal, testVal, `${testVal} was not assigned to the object (normal setter)`);
		});

		it('can set a custom getter (object)', function () {
			const prop = 'test_getter', testObj = { test: 'First:' }, append = 'Second';

			guildConfig.register(prop, Object, {
				default: testObj,
				get () {
					return this.test + append;
				},
			});

			for (const [key, val] of testGuild) {
				if (key === prop) {
					assert.equal(val, testObj, `${val} is stored instead of ${testObj}`);
					break;
				}
			}
			assert.equal(testGuild[prop], testObj.test + append, `got ${testGuild[prop]} instead of ${testObj.test}${append}`);
		});

		it('can save properties');

		it('can load properties');

		it('can set custom json converters');

		it('can save properties with custom converters');

		it('can load properties with custom converters');
	});

	after(async function () {
		await guildConfig.deleteGuildConfig(testGuild.id);
	});
});
