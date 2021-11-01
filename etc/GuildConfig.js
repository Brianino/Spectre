'use strict';

const log = require('../utils/logger.js')('guild-config');
const parseBool = require('../utils/parseBool.js');
const mappingUtils = require('./MappingUtils.js');
const {promises:fs, constants} = require('fs');
const {Permissions} = require('discord.js');
const {prefix} = require('../config.json');
const time = require('../utils/time.js');
const Path = require('path');

const guilds = new Map(), confProp = new Set(), configurable = new Map();

const confDir = Path.resolve(__dirname, '../data/');

const sym = {
	guildStore: Symbol(),
	confVars: Symbol(),
}

/** The config object to interact with the configured guild properties
 * All config objects can be extended with the [config manager]{@link ConfigManager#register}
 * Setting any of the properties will cause the config properties to get saved
 * @typedef {Proxy} ConfigObject
 * @prop {string}  id          - the guild id of the guild the config object applies to
 * @prop {string}  prefix      - the prefix required to run commands
 * @prop {getPerm} permissions - can be set with {@link setPerm}
 * @prop {Set}     disabled    - the set of disabled commands on the guild
*/

/** Custom method to return the permissions associated to a particular command
 * @typedef {function} getPerm
 * @desc gets the permissions required to run the command on a specific guild
 * @param {string} cmdName - the name of the command to get the permssions for
 * @return {Permissions} the permissions required to run a command on a specific guild
*/

/** Argument for the custom setter, should be provided as an array of arguments
 * @typedef {function} setPerm
 * @param {string} cmd   - the command name
 * @param {...*}   perms - a list of [permission resolvables]{@link https://discord.js.org/#/docs/main/stable/typedef/PermissionResolvable}
*/

/** converts a parsed json object back into a map of property keys to property values
 * @private
 * @param {string} id  - the id of the guild that this property map applies to
 * @param {Object} obj - the object that would be returned from JSON.parse on a json string
 * @param {Set} varStore - the set of all available config properties that may or may not be already configured
 * @returns {Map} property key to property value map
*/
function convert (id, obj, varStore) {
	let res = new Map([['id', String(id)]]);

	for (let key in obj) {
		try {
			if (key !== 'id') {
				let {type} = varStore.get(key);
				res.set(key, mappingUtils.asObject(type, obj[key]));
			}
		} catch (e) {
			log.error('Unable to parse', key, 'for', obj.id, 'because', e.toString());
			log.debug('in store:', [...varStore.keys()].toString());
			log.file.guildConfig('ERROR Unable to parse', key, 'for', obj.id, 'because', e);
		}
	}
	return res;
}

/** converts a map of property names to property values into a json string
 * @private
 * @param {Map}	map - a map of property names to property values
 * @param {Set} varStore - the set of all available config properties that may or may not be already configured
 * @returns {(string|undefined)} the json string if more than the id property is set
*/
function stringify (map, varStore) {
	let res = {}, moreThanId = false;
	for (let [key, val] of map) {
		try {
			if (key !== 'id') {
				let {type} = varStore.get(key);
				res[key] = mappingUtils.asJson(type, val);
				if (res[key] instanceof Array && !res[key].length)
					delete res[key];
				else if (res[key] instanceof Object && !Object.getOwnPropertyNames(res[key]).length)
					delete res[key];
				else
					moreThanId = true;
			}
		} catch (e) {
			log.error('Unable to stringify', key, 'for', map.get('id'), 'because', e.toString());
			log.file.guildConfig('ERROR Unable to stringify', key, 'for', map.get('id'), 'because', e);
		}
	}
	if (moreThanId)
		return JSON.stringify(res);
}

/** Writes the guild config map to file
 * @private
 * @param {Map}	guildObj - the map of guild config variable names to config values
 * @param {Set} varStore - the set of all available config properties that may or may not be already configured
*/
async function saveConfig (guildObj, varStore) {
	let path = Path.resolve(confDir, guildObj.get('id') + '.json'), data = stringify(guildObj, varStore);

	if (data) {
		log.debug(time(), 'Attempting to save config:', path);
		log.file.guildConfig('INFO Attempting to save config:', path);
		return fs.writeFile(path, data, {flag: 'w'});
	} else {
		let exists = true;

		await fs.access(path, constants.F_OK).catch(e => exists = false);

		if (exists) {
			log.debug(time(), 'Deleting config:', path);
			log.file.guildConfig('INFO Deleting config:', path);
			return fs.unlink(path);
		}
	}
}

/** Loads the guild config map from file
 * @private
 * @param {Set} varStore - the set of all available config properties
 * @return {Map} the map of guild config variable names to config values
*/
async function loadConfig (varStore) {
	let dir = await fs.readdir(confDir, {encoding: 'utf8', withFileTypes: true}), res = new Map();

	for (let file of dir) {
		if (file.isFile()) {
			try {
				let conf = require(Path.join(confDir, file.name)), id = Path.basename(file.name, '.json');

				res.set(String(id), convert(id, conf, varStore));
			} catch (e) {
				log.warn(time(), 'Unable to load config for', file.name);
				log.debug(e);
				log.file.guildConfig('WARN Unable to load config for', file.name, e);
			}
		}
	}
	return res;
}

/** Disguises the config map object as a normal object that only allows the modification of the values
 * @private
 * @param {Map} map      - the config map object to disguise
 * @param {Set} varStore - the set of all available properties that may or may not already be present on the map
 * @return {Proxy} the map object disgused to act as a standard object, where the properties as the config values
*/
function proxifyMap (map, varStore) {
	return new Proxy(map, {
		get (target, prop, receiver) {
			let descriptor = varStore.get(prop), value = target.get(prop) ?? descriptor?.default;

			if (prop === Symbol.iterator) {
				log.debug('Returning config iterator on', target.get('id'));
				log.file.guildConfig('INFO Returning config iterator on', target.get('id'));
				return target[Symbol.iterator].bind(target);
			} else if (prop === Symbol.toPrimitive) {
				log.debug('Returning config string value (id) on', target.get('id'));
				log.file.guildConfig('INFO Returning config string value (id) on', target.get('id'));
				return () => {
					return map.get('id');
				}
			} else if (descriptor?.get) {
				log.debug('Using custom getter for', prop, 'on', target.get('id'));
				log.file.guildConfig('INFO Using custom getter for', prop, 'on', target.get('id'));
				if (typeof value === 'object')
					return descriptor.get.call(value);
				else
					return descriptor.get(value);
			}
			log.debug('Returning the value of', prop, 'which is', value);
			return value;
		},
		set (target, prop, value, receiver) {
			let descriptor = varStore.get(prop);
			switch (typeof prop) {
				case 'number':
				case 'bigint': {
					prop = String(prop);
				}

				case 'string': {
					if (prop === 'id') {
						log.debug('Blocking set to id on', target.get('id'));
						log.file.guildConfig('WARN Blocking set to id on', target.get('id'));
						throw new Error('Cannot set id');
					}

					if (!varStore.has(prop)) {
						log.debug('Blocking set to unknown variable:', prop, 'on', target.get('id'));
						log.file.guildConfig('WARN Blocking set to unknown variable:', prop, 'on', target.get('id'));
						throw new Error('Property ' + prop + ' does not exist');
					}

					if (descriptor.set) {
						let propVal = target.get(prop) ?? descriptor.default;

						log.debug('Using custom setter for', prop, 'with value', value, 'on', target.get('id'));
						if (typeof propVal === 'object') {
							descriptor.set.call(propVal, value);
							return true;
						} else {
							value = descriptor.set(value);
						}
					}
					if (value === undefined) {
						log.debug('Removing value of', prop);
						log.file.guildConfig('INFO Removing value of', prop, 'on', target.get('id'));
						target.delete(prop);
						return true;
					} else if (value.constructor.name.toLowerCase() !== descriptor.type) {
						log.debug('Unable to set value due to type mismatch:', value.constructor.name, 'instead of', descriptor.type);
						throw new Error('Value does not match expected type of ' + descriptor.type);
					}
					log.debug('Updating value of', prop, 'to', value);
					log.file.guildConfig('INFO Updating value of', prop, 'to', value, 'on', target.get('id'));
					target.set(prop, value);
					saveConfig(target, varStore).catch(e => {
						log.error(time(), 'Unable to save config for', target.get('id'));
						log.file.guildConfig('ERROR Unable to save config for', target.get('id'), e);
					});
					return true;
				}
				break;

				default: {
					log.debug('Unable to set value due to prop type:', typeof prop, prop);
					throw new Error('Property needs to be a string');
				}
			}
		},
		has (target, prop) {
			log.debug('Checking if the map has', prop);
			return varStore.has(prop);
		},
		getOwnPropertyDescriptor (target, prop) {
			let value = target.get(prop);

			if (value)
				return {configurable: false, writable: true, value: value};
		},
		ownKeys (target) {
			return [...target.keys()];
		},
		preventExtensions () {return true; },
		defineProperty () {return false; },
		deleteProperty () {return false; },
		setPrototypeOf () {return false; },
		getPrototypeOf () {return null; },
		isExtensible () {return false; },
	});
}

/** Converts a type, to its string name
 * @private
 * @param {*} type - the input to try and pull a type name from
 * @return {string} type name as a string
*/
function getTypeName (type) {
	if (!type)
		return;
	switch (typeof type) {
		case 'object':
			type = type.constructor.name;
			break;

		case 'function':
			type = type.name;
			break;

		default:
			type = String(type);
			break;
	}
	return type.toLowerCase();
}

/** Returns true if a type is allowed to have getters and setters (so should be false on primative types)
 * @private
 * @param {string} typeName - the name of the type
 * @return {boolean} true if the type can have a getter or setter
*/
function canHaveGetters (typeName) {
	switch (typeName) {
		case 'symbol':
		case 'bigint':
		case 'number':
		case 'boolean':
		case 'string':
			return false;
			break;
		default:
			return true;
			break;
	}
}

/** Handles the storage and manipulations of config objects for each guild */
class ConfigManager {
	constructor () {
		let confVars = new Map();

		confVars.set('prefix', {
			type: 'string',
			default: prefix,
			desc: 'prefix to use for commands',
			configurable: true,
			set (input) {
				if (String(input).startsWith('/'))
					throw new Error('Prefix cannot start with /');
				return String(input);
			}
		});
		confVars.set('permissions', {
			type: 'map',
			default: new Map(),
			configurable: false,
			get () {
				return (cmd) => {
					if (typeof cmd === 'object')
						cmd = cmd.command;
					return this.get(cmd);
				};
			},
			set ([cmd, ...permissions]) {
				if (typeof cmd === 'object')
					cmd = cmd.command;
				if (permissions.length)
					this.set(cmd, new Permissions(permissions));
				else
					this.delete(cmd);
			}
		});
		confVars.set('disabled', {
			type: 'set',
			default: new Set(),
			configurable: false,
			set (input) {
				for (let val of input) {
					this.add(val);
				}
			},
		});
		Object.defineProperties(this, {
			[sym.confVars]: {value: confVars},
			[sym.guildStore]: {value: new Map(), writable: true},
		});
	};

	/** Returns the stored config object for a particular guild
	 * @param {string} guildId - the id of the guild to get the config object for
	 * @return {ConfigObject} the config object
	*/
	getGuildConfig (guildId) {
		let result = this[sym.guildStore].get(guildId = String(guildId));

		if (!result) {
			log.debug('Creating new config store for guild', guildId);
			if (guildId !== 'undefined' && guildId !== 'null')
				this[sym.guildStore].set(guildId, result = new Map([['id', guildId]]));
			else
				result = new Map([['id', guildId]]);
		}
		return proxifyMap(result, this[sym.confVars]);
	}

	/** Deletes the stored config object and file for a particular guild
	 * @param {string} guildId - the id of the guild to delete
	 * @return {boolean} true if there was a config object to delete
	*/
	async deleteGuildConfig (guildId) {
		let deleted = this[sym.guildStore].delete(guildId = String(guildId));

		if (deleted)
			await saveConfig(new Map([['id', guildId]]));
		return deleted;
	}

	/** Returns a map of all the user configurable variables
	 * @return {Map} a map of property names, to an array with the property type and desc
	*/
	getConfigurable () {
		let res = new Map();

		for (let [key, {type, desc, configurable}] of this[sym.confVars]) {
			if (configurable)
				res.set(key, [type, desc]);
		}
		return res;
	}

	/** Extra properties object
	 * @typedef {Object} extraProperties
	 * @prop {*}        [default]      - the default value of the config variable if one isn't set
	 * @prop {boolean}  [configurable] - true if a user should be able to set the value of this property directly (will assume true if left undefined and a description is provided)
	 * @prop {string}   [description]  - a description of what the property is used for
	 * @prop {function} [get]          - a custom getter method for the property
	 * @prop {function} [set]          - a custom setter method for the property
	 * @prop {function} [toJson]       - a custom method to convert the property to an object that can be serialized with JSON.stringify
	 * @prop {function} [from]         - a custom method to convert a json object back into the complext type of the variable
	*/

	/** Registers a new config property that can be accessed/set on a [Config object]{@link ConfigObject}
	 * @param {string}          name  - the name of the property
	 * @param {*}               type  - the type of object stored on the property (will use a constructor name, or the string value)
	 * @param {extraProperties} param - extra modifiable properties
	}
	*/
	register (name, type, {default:defaultVal, configurable, description, get, set, toJson, from}) {
		let temp;

		name = String(name);
		type = getTypeName(type);
		log.debug('Type for', name, 'is', type);
		if (!type) return;
		if (this[sym.confVars].has(name)) return;
		this[sym.confVars].set(name, temp = {
			type: type,
			default: defaultVal,
			desc: description,
			configurable: (typeof configurable === 'boolean')? configurable : !!description,
		});
		if (canHaveGetters(type)) {
			log.debug('Setting getters/setters for', name);
			temp.get = get;
			temp.set = set;
		}
		if (toJson && from) {
			Object.defineProperty(mappingUtils, type, {value: {toJson, from}});
			log.debug('Set up json conversion functions for property', name);
			log.file.guildConfig('INFO Set up json conversion functions for property', name);
		}
		log.info('Finished registering config property', name);
		log.file.guildConfig('INFO Finished registering config property', name);
		// iterate through store and convert any non converted objects
	}

	/** Parses the guild config from the config files */
	async loadConfig () {
		this[sym.guildStore] = await loadConfig(this[sym.confVars]);
		log.info(time(), 'Loaded config directory successfully');
		log.file.guildConfig('INFO Loaded config directory successfully');
	}
}

module.exports = ConfigManager;
