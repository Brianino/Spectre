const log = require('./logger.js')('guild-config');
const {parseBool, time} = require('./utilities.js');
const mappingUtils = require('./mappingUtils.js');
const {promises:fs, constants} = require('fs');
const {Permissions} = require('discord.js');
const {prefix} = require('../config.json');
const Path = require('path');

const guilds = new Map(), confProp = new Set(), configurable = new Map();

const confDir = Path.resolve(__dirname, '../data/');

const sym = {
	guildStore: Symbol(),
	confVars: Symbol(),
}

function convert (id, obj) {
	let res = new Map([['id', String(id)]]);

	for (let key in obj) {
		let {type, val} = obj[key];
		res.set(key, mappingUtils.asObject(type, val));
	}
	return res;
}

function stringify (map) {
	let res = {}, moreThanId = false;
	for (let [key, val] of map) {
		let str = JSON.stringify(val);

		if (str) {
			res[key] = {
				type: val.constructor.name,
				val: mappingUtils.asString(val.constructor.name, val),
			}
			if (key !== 'id')
				moreThanId = true;
		}
	}
	if (moreThanId)
		return JSON.stringify(res);
}

async function saveConfig (guildObj) {
	let path = Path.resolve(confDir, guildObj.get('id') + '.json'), data = stringify(guildObj);

	if (data) {
		log.debug(time(), 'Attempting to save config:', path);
		log.file.guildConfig('Attempting to save config:', path);
		return fs.writeFile(path, data, {flag: 'w'});
	} else {
		let exists = true;

		await fs.access(path, constants.F_OK).catch(e => exists = false);

		if (exists) {
			log.debug(time(), 'Deleting config:', path);
			log.file.guildConfig('Deleting config:', path);
			return fs.unlink(path);
		}
	}
}

async function loadConfig () {
	let dir = await fs.readdir(confDir, {encoding: 'utf8', withFileTypes: true}), res = new Map();

	for (let file of dir) {
		if (file.isFile()) {
			try {
				let {id, ...conf} = require(path.join('../', dirPath, file.name));

				if (!id) id = file.name.substr(0, file.name.length - '.json'.length);

				res.set(String(id), convert(id, conf));
			} catch (e) {
				log.warn(time(), 'Unable to load config for', file.name);
				log.file('WARN Unable to lead config for', file.name, e);
			}
		}
	}
	return res;
}

function proxifyMap (map, varStore) {
	return new Proxy(map, {
		get (target, prop, receiver) {
			let descriptor = varStore.get(prop), value = target.get(prop) || descriptor?.default;
			if (prop === Symbol.iterator) {
				log.debug('Returning config iterator on', target.get('id'));
				log.file.guildConfig('Returning config iterator on', target.get('id'));
				return target[Symbol.iterator].bind(target);
			}
			if (descriptor.get && value) {
				log.debug('Using custom getter for', prop, 'on', target.get('id'));
				log.file.guildConfig('Using custom getter for', prop, 'on', target.get('id'));
				return descriptor.get.call(value);
			}
			log.debug('Returning the value of', prop, 'which is', value);
			return value;
		},
		set (target, prop, value, receiver) {
			let descriptor = varStore.get(prop);
			switch (typeof prop) {
				case 'string':
				case 'number':
				case 'bigint':
					if ((prop = String(prop)) === 'id') {
						log.debug('Blocking set to id on', target.get('id'));
						log.file.guildConfig('Blocking set to id on', target.get('id'));
						return false;
					}
					if (!varStore.has(prop)) {
						log.debug('Blocking set to unknown variable:', prop, 'on', target.get('id'));
						log.file.guildConfig('Blocking set to unknown variable:', prop, 'on', target.get('id'));
						return false;
					}

					if (descriptor.set) {
						let propVal = target.get(prop) || descriptor?.default, retVal;

						log.debug('Using custom setter for', prop, 'with value', value, 'on', target.get('id'));
						if (propVal) {
							retVal = descriptor.set.call(propVal, value);
							value = retVal? retVal : propVal;
						} else {
							retVal = descriptor.set(value);
							if (!retVal) {
								log.debug('Unable to use custom setter for', prop, 'due to missing value on', target.get('id'));
								log.file.guildConfig('Unable to use custom setter for', prop, 'due to missing value on', target.get('id'));
								return false;
							}
							value = retVal;
						}
					}
					if (value.constructor.name.toLowerCase() !== descriptor.type) {
						log.debug('Unable to set value due to type mismatch', value.constructor.name, descriptor.type);
						return false;
					}
					log.debug('Updating value of', prop, 'to', value);
					target.set(prop, value);
					saveConfig(target).catch(e => {
						log.error(time(), 'Unable to save config for', target.get('id'));
						log.file('ERROR Unable to save config for', target.get('id'), e);
					});
					return true;
					break;

				default:
					log.debug('Unable to set value due to prop type:', typeof prop, prop);
					return false;
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

module.exports = class configManager {
	constructor () {
		let confVars = new Map();

		confVars.set('prefix', {
			type: 'string',
			default: prefix,
			desc: 'prefix to use for commands',
			configurable: true,
		});
		confVars.set('permissions', {
			type: 'map',
			default: new Map(),
			configurable: false,
			get () {
				return (cmd) => this.get(cmd);
			},
			set ([cmd, ...permissions]) {
				this.set(cmd, new Permissions(permissions));
			}
		});
		confVars.set('disabled', {
			type: 'set',
			default: new Set(),
			configurable: false,
			set (val) {
				if (!val instanceof Set)
					val = new Set(val);
				return val;
			},
		});
		Object.defineProperties(this, {
			[sym.confVars]: {value: confVars},
			[sym.guildStore]: {value: new Map()},
		});
	};

	getGuildConfig (guildId) {
		let result = this[sym.guildStore].get(guildId = String(guildId));

		if (!result) {
			log.debug('Creating new config store for guild', guildId);
			this[sym.guildStore].set(guildId, result = new Map([['id', guildId]]));
		}
		return proxifyMap(result, this[sym.confVars]);
	}

	async deleteGuildConfig (guildId) {
		let deleted = this[sym.guildStore].delete(guildId = String(guildId));

		if (deleted)
			await saveConfig(new Map([['id', guildId]]));
		return deleted;
	}

	getConfigurable () {
		let res = new Map();

		for (let [key, {type, desc, configurable}] of this[sym.confVars]) {
			if (configurable)
				res.set(key, [type, desc]);
		}
		return res;
	}

	register (name, type, {default:defaultVal, configurable = true, description, get, set, toJson, from}) {
		let temp;

		name = String(name);
		type = getTypeName(type);
		if (!type) return;
		if (this[sym.confVars].has(name)) return;
		this[sym.confVars].set(name, temp = {
			type: type,
			default: defaultVal,
			desc: description,
			configurable: configurable,
		});
		if (canHaveGetters(type)) {
			temp.get = get;
			temp.set = set;
		}
		if (toJson && from) {
			Object.defineProperty(mappingUtils, type, {value: {toJson, from}});
			log.debug('Set up json conversion functions for property', name);
			log.file.guildConfig('Set up json conversion functions for property', name);
		}
		log.info('Finished registering config property', name);
		log.file.guildConfig('Finished registering config property', name);
	}

	async loadConfig () {
		this[sym.guildStore] = await loadConfig();
		log.info(time(), 'Loaded config directory successfully');
		log.file.guildConfig('Loaded config directory successfully');
	}
}
