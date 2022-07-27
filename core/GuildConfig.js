import { promises as fs, constants } from 'fs';
import MappingUtils from './MappingUtils.js';
import getConfig from './configUtils.js';
import { Permissions } from 'discord.js';
import { fileURLToPath } from 'url';
import lock from './namedLock.js';
import logger from './logger.js';
import Path from 'path';

const log = logger('Guild-Config'),
	confDir = Path.resolve(fileURLToPath(import.meta.url), '../../data/'),
	{ prefix } = getConfig();
let configDirExists = false;

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
	const res = new Map([['id', String(id)]]);

	for (const key in obj) {
		try {
			log.debug('Processing Key', key);
			if (key !== 'id') {
				const { type } = varStore.get(key);
				res.set(key, MappingUtils.asObject(type, obj[key]));
			}
		} catch (e) {
			if (!varStore.has(key))
				log.warn('Missing definition for:', key, `(Guild: ${id})`);
			else
				log.error('Unable to parse', key, 'for', id, 'because', e);
			log.debug('in store:', [...varStore.keys()].toString());
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
	const res = {};
	let moreThanId = false;
	for (const [key, val] of map) {
		try {
			log.debug('Key', key, 'value', typeof val, val, 'store', varStore.get(key));
			if (key !== 'id') {
				const { type } = varStore.get(key);
				res[key] = MappingUtils.asJson(type, val);
				if (res[key] instanceof Array && !res[key].length)
					delete res[key];
				else if (res[key] instanceof Object && !Object.getOwnPropertyNames(res[key]).length)
					delete res[key];
				else
					moreThanId = true;
			}
		} catch (e) {
			log.error('Unable to stringify', key, 'for', map.get('id'), 'because', e);
		}
	}
	if (moreThanId)
		return JSON.stringify(res);
}

/** Created the config directory if it doesn't exist already
 * @private
*/
async function createConfigDir () {
	if (configDirExists)
		return;
	configDirExists = true;
	try {
		await fs.stat(confDir);
	} catch (ignore) {
		log.warn('Config dir didn\'t exist, will create the config dir', confDir);
		await fs.mkdir(confDir);
	}
}

/** Writes the guild config map to file
 * @private
 * @param {Map}	guildObj - the map of guild config variable names to config values
 * @param {Set} varStore - the set of all available config properties that may or may not be already configured
*/
async function saveConfig (guildObj, varStore) {
	const path = Path.resolve(confDir, `${guildObj.get('id')}.json`), data = stringify(guildObj, varStore);

	log.debug('Awaiting lock for', path);
	const unlock = await lock(path).acquire();
	log.debug('Locked', path);
	if (data) {
		log.info('Attempting to save config:', path, 'data:', data);
		await createConfigDir();
		await fs.writeFile(path, data, { flag: 'w' });
	} else {
		let exists = true;

		await fs.access(path, constants.F_OK).catch(() => exists = false);

		if (exists) {
			log.info('Deleting config:', path);
			await fs.unlink(path);
		}
	}
	log.debug('Unlocking', path);
	unlock();
}

/** Loads the guild config map from file
 * @private
 * @param {Set} varStore - the set of all available config properties
 * @return {Map} the map of guild config variable names to config values
*/
async function loadConfig (varStore) {
	const res = new Map();

	await createConfigDir();
	const dir = await fs.readdir(confDir, { encoding: 'utf8', withFileTypes: true });
	for (const file of dir) {
		if (file.isFile()) {
			try {
				const conf = JSON.parse(await fs.readFile(Path.join(confDir, file.name))),
					id = Path.basename(file.name, '.json');

				log.debug('File name is', file.name, 'id', id, varStore);
				res.set(String(id), convert(id, conf, varStore));
			} catch (e) {
				log.warn('Unable to load config for', file.name, e);
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
		get (target, prop) {
			const descriptor = varStore.get(prop), value = target.get(prop) ?? descriptor?.default;

			if (prop === Symbol.iterator) {
				log.info('Returning config iterator on', target.get('id'));
				return target[Symbol.iterator].bind(target);
			} else if (prop === Symbol.toPrimitive) {
				log.info('Returning config string value (id) on', target.get('id'));
				return () => {
					return map.get('id');
				};
			} else if (descriptor?.get) {
				log.info('Using custom getter for', prop, 'on', target.get('id'));
				if (typeof value === 'object')
					return descriptor.get.call(value);
				else
					return descriptor.get(value);
			}
			log.debug('Returning the value of', prop, 'which is', value);
			return value;
		},
		set (target, prop, value) {
			const descriptor = varStore.get(prop);
			switch (typeof prop) {
				case 'number':
				case 'bigint': {
					prop = String(prop);
				}

				case 'string': {
					if (prop === 'id') {
						log.warn('Blocking set to id on', target.get('id'));
						throw new Error('Cannot set id');
					}

					if (!varStore.has(prop)) {
						log.warn('Blocking set to unknown variable:', prop, 'on', target.get('id'));
						throw new Error(`Property ${prop} does not exist`);
					}

					if (descriptor.set) {
						let propVal = target.get(prop) ?? descriptor.default;
						log.debug('Using custom setter for', prop, 'with value', value, 'on', target.get('id'));
						if (typeof propVal === 'object') {
							if (propVal === descriptor.default) {
								// Stringify then parse the value to clone it
								// This is to avoid the default instance being modified (and then propogating changes to other servers)
								const json  = MappingUtils.asJson(descriptor.type, descriptor.default);
								log.debug('Stringifiable object:', json, 'default', descriptor.default, 'type', descriptor.type);
								const clone = MappingUtils.asObject(descriptor.type, json);
								log.debug('Clone is?', clone);
								propVal = clone;
							}
							descriptor.set.call(propVal, value);
							value = propVal;
						} else {
							value = descriptor.set(value);
						}
					}
					if (value === undefined) {
						log.info('Removing value of', prop);
						target.delete(prop);
					} else if (value.constructor.name.toLowerCase() !== descriptor.type) {
						log.debug('Unable to set value due to type mismatch:', value.constructor.name, 'instead of', descriptor.type);
						throw new Error(`Value does not match expected type of ${descriptor.type}`);
					} else {
						log.info('Updating value of', prop, 'to', value);
						target.set(prop, value);
					}
					if (target.get('id')) {
						saveConfig(target, varStore).catch(e => {
							log.error('Unable to save config for', target.get('id'), e);
						});
					}
					return true;
				}

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
			const value = target.get(prop);

			if (value)
				return { configurable: false, writable: true, value: value };
		},
		ownKeys (target) {
			return [...target.keys()];
		},
		preventExtensions () { return true; },
		defineProperty () { return false; },
		deleteProperty () { return false; },
		setPrototypeOf () { return false; },
		getPrototypeOf () { return null; },
		isExtensible () { return false; },
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
		default:
			return true;
	}
}

/** Handles the storage and manipulations of config objects for each guild */
class ConfigManager {
	#confVars = new Map();
	#guildStore = new Map();

	constructor () {
		this.#confVars.set('prefix', {
			type: 'string',
			default: prefix,
			desc: 'prefix to use for commands',
			configurable: true,
			set (input) {
				if (String(input).startsWith('/'))
					throw new Error('Prefix cannot start with /');
				return String(input);
			},
		});
		this.#confVars.set('permissions', {
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
				if (!cmd)
					return;
				if (!permissions.length)
					return this.delete(cmd);

				let res = 0n;
				for (const perm of permissions) {
					try {
						res |= BigInt(perm);
					} catch (ignore) {
						if (Object.hasOwn(Permissions.FLAGS, perm))
							res |= Permissions.FLAGS[perm];
					}
				}
				this.set(cmd, new Permissions(res));
			},
		});
		this.#confVars.set('disabled', {
			type: 'set',
			default: new Set(),
			configurable: false,
			set (input) {
				for (const val of input)
					this.add(val);
			},
		});
	}

	/** Returns the stored config object for a particular guild
	 * @param {string} guildId - the id of the guild to get the config object for
	 * @return {ConfigObject} the config object
	*/
	getGuildConfig (guildId) {
		let result = this.#guildStore.get(guildId = String(guildId));

		if (!result) {
			log.debug('Creating new config store for guild', guildId);
			if (guildId !== 'undefined' && guildId !== 'null')
				this.#guildStore.set(guildId, result = new Map([['id', guildId]]));
			else
				result = new Map([['id', guildId]]);
		}
		return proxifyMap(result, this.#confVars);
	}

	/** Deletes the stored config object and file for a particular guild
	 * @param {string} guildId - the id of the guild to delete
	 * @return {boolean} true if there was a config object to delete
	*/
	async deleteGuildConfig (guildId) {
		const deleted = this.#guildStore.delete(guildId = String(guildId));

		if (deleted)
			await saveConfig(new Map([['id', guildId]]));
		return deleted;
	}

	/** Returns a map of all the user configurable variables
	 * @return {Map} a map of property names, to an array with the property type and desc
	*/
	getConfigurable () {
		const res = new Map();

		for (const [key, { type, desc, configurable }] of this.#confVars) {
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
	register (name, type, { default: defaultVal, configurable, description, get, set }) {
		let temp;

		name = String(name);
		type = getTypeName(type);
		log.debug('Type for', name, 'is', type);
		if (!type)
			return;
		if (this.#confVars.has(name))
			return;
		this.#confVars.set(name, temp = {
			type: type,
			default: defaultVal,
			desc: description,
			configurable: (typeof configurable === 'boolean') ? configurable : !!description,
		});
		if (canHaveGetters(type)) {
			log.debug('Setting getters/setters for', name);
			temp.get = get;
			temp.set = set;
		}
		log.info('Finished registering config property', name);
		// iterate through store and convert any non converted objects
	}

	/** Parses the guild config from the config files */
	async loadConfig () {
		this.#guildStore = await loadConfig(this.#confVars);
		log.info('Loaded config directory successfully');
	}
}

export { ConfigManager as default };
