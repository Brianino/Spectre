const log = require('debug-logger')('module-loader');
const {promises:fs, constants} = require('fs');
const {Permissions} = require('discord.js');
const {prefix} = require('../config.json');
const time = require('./time.js');

const guilds = new Map(), confProp = new Set(), configurable = new Map();

async function saveConfig (guildObj) {
	let path = './data/' + guildObj.id + '.json', data = guildObj.toJsonObj();

	if (data) {
		log.debug(time(), 'Attempting to save config:', path);
		return fs.writeFile(path, JSON.stringify(data), {flag: 'w'});
	} else {
		let exists = true;

		await fs.access(path, constants.F_OK).catch(e => exists = false);

		if (exists) {
			log.debug(time(), 'Deleting config:', path);
			return fs.unlink(path);
		}
	}
}

class config {
	constructor (guildid) {
		Object.defineProperty(this, 'id', {value: guildid});
		this.prefix();
		this.permissions();
		this.disabled();
	}

	prefix () {
		let prop = 'prefix', internal, tmp;
		//WARNING DO NOT CHANGE THE INITIAL VALUE OF INTERNAL

		if (this.saved && (tmp = this.saved(prop))) internal = String(tmp);
		Object.defineProperty(this, prop, {
			set: (val) => {
				if (val !== undefined) internal = String(val);
				else internal = undefined;

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get: () => internal || prefix,
		});
		configurable.set(prop, [String, 'prefix to use for commands']);
	}

	permissions () {
		let prop = 'permissions', internal = new Map(), tmp;
		//WARNING DO NOT CHANGE THE INITIAL VALUE OF INTERNAL

		if (this.saved && (tmp = this.saved(prop))) internal = new Map(tmp);
		Object.defineProperty(this, prop, {
			set: ([cmd, ...permissions]) => {
				if (permissions[0] !== undefined) internal.set(cmd, new Permissions(permissions));
				else internal.delete(cmd);

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get: () => cmd => internal.get(cmd),
		});
		Object.defineProperty(this, 'internalPerms', {
			get: () => internal
		});
	}

	disabled () {
		let prop = 'disabled', internal = new Set(), tmp;
		//WARNING DO NOT CHANGE THE INITIAL VALUE OF INTERNAL

		if (this.saved && (tmp = this.saved(prop))) internal = new Set(tmp);
		Object.defineProperty(this, prop, {
			set: (val) => {
				if (val instanceof Set) internal = val;
				else if (val !== undefined) internal = new Set(val);
				else internal = new Set();

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get: () => new Set(internal),
		});
	}

	toJsonObj () {
		let obj = {id: this.id};

		if (this.prefix !== prefix) obj.prefix = this.prefix;
		if (this.internalPerms.size) obj.permissions = [...this.internalPerms].map(([key, val]) => [key, val.bitfield]);
		if (this.disabled.size) obj.disabled = [...this.disabled];
		for (let {name, val, func} of confProp) {
			if (this[val()] !== undefined) obj[name] = func(this[name]);
		}
		log.debug('Property count:', Object.getOwnPropertyNames(obj).length);
		if (Object.getOwnPropertyNames(obj).length > 1) return obj;
		return;
	}

	getConfigurable () {
		return new Map(configurable);
	}
}

module.exports.saved = guilds;

module.exports.config = config;

/*
 * @param {String} name: the property name to put the value under on the config object
 * @param {Functions} type: constructor function, or primative type for the value
 * @param {*} defaultVal: the default value to return if there is no alternative stored
 * @param {Function} func: a function to convert the stored config value into a json stringifiable value
    * the result of the function should be a valid contructor argument
*/
module.exports.register = function registerConfig (name, type, defaultVal, userEditable = true, desc) {
	let internal = Symbol('Internal val'), func;

	name = String(name);
	if (typeof type !== 'function') {
		log.error(time(), 'Error registering', name, '; constructor not passed for type');
		return;
	}
	if (name in config.prototype) return log.warn('Config property', name, 'already exists');
	switch (type) {
		// Only primative types should exist between here and the break
		case String:
		case Number:
		case Boolean:

		func = (val) => val;
		if (defaultVal && typeof defaultVal !== type.name.toLowerCase()) {
			log.warn('Default value of', name, 'not of the same type, setting to', '"' + type() + '"', 'instead');
			defaultVal = type();
		}
		Object.defineProperty(config.prototype, name, {
			set (val) {
				log.debug(time(), 'Setting config:', this.id, name);
				if (val !== undefined) this[internal] = type(val);
				else this[internal] = undefined;

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get () {
				if (!this[internal]) this[internal] = this.saved(name);
				log.debug(time(), 'Getting config:', this.id, name);
				return this[internal] || defaultVal;
			}
		});
		break;

		// Below are object config types that don't support user configuration (meaning they are not exposed to the user for configuration)
		case Object: if (!func) func = (val) => val;
		case Map: if (!func) func = (val) => [...val];
		userEditable = false;

		// Below are object types that support user configuration
		case Array: if (!func) func = (val) => val;
		case Set: if (!func) func = (val) => [...val];
		case Permissions: if (!func) func = (val) => val.bitfield;
		if (defaultVal && !defaultVal instanceof type) {
			log.warn('Default value of', name, 'not an instance of,', type.name, ', setting to undefined instead');
			defaultVal = undefined;
		}
		Object.defineProperty(config.prototype, name, {
			set (val) {
				log.debug(time(), 'Setting config:', this.id, name);
				if (val !== undefined && !val instanceof type) this[internal] = new type(val);
				else if (val !== undefined) this[internal] = val;
				else this[internal] = undefined;

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get () {
				if (!this[internal]) this[internal] = new type(this.saved(name));
				log.debug(time(), 'Getting config:', this.id, name);
				return this[internal] || defaultVal;
			}
		});
		break;

		default: throw new Error('Type not supported');
	}
	if (typeof userEditable === 'string') {
		configurable.set(name, [type, userEditable]);
	} else if (userEditable) configurable.set(name, [type, desc]);
	confProp.add({name: name, val: () => internal, func: func});
	log.debug(time(), 'Should have registered property:', name, 'type', type.name);
}
