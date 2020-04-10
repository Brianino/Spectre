const log = require('debug-logger')('module-loader');
const {promises:fs, constants} = require('fs');
const {Permissions} = require('discord.js');
const {prefix} = require('../config.json');
const time = require('./time.js');

const guilds = new Map(), confProp = new Set();

async function saveConfig (guildObj) {
	let path = './data/' + guildObj.id + '.json', data = guildObj.toJsonObj();

	if (data) {
		log.debug(time(), 'Attempting to save config:', path);
		return fs.writeFile(path, JSON.stringify(data), {flag: 'w'});
	} else {
		let exists = true;

		await fs.access(name, constants.F_OK).catch(e => exists = false);

		if (exists) {
			log.debug(time(), 'Deleting config:', path);
			return fs.unlink(+ path);
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
	}

	permissions () {
		let prop = 'permissions', internal, tmp;
		//WARNING DO NOT CHANGE THE INITIAL VALUE OF INTERNAL

		if (this.saved && (tmp = this.saved(prop))) internal = new Permissions(tmp);
		Object.defineProperty(this, prop, {
			set: (val) => {
				if (val !== undefined) internal = new Permissions(val);
				else internal = undefined;
				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get: () => internal,
		});
	}

	disabled () {
		let prop = 'disabled', internal, tmp;
		//WARNING DO NOT CHANGE THE INITIAL VALUE OF INTERNAL

		if (this.saved && (tmp = this.saved(prop))) internal = new Set(tmp);
		else internal = false;
		Object.defineProperty(this, prop, {
			set: (val) => {
				if (val !== undefined && !val instanceof Set) internal = new Set(val);
				else if (val !== undefined) internal = val;
				else internal = undefined;
				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get: () => internal || new Set(),
		});
	}

	toJsonObj () {
		let obj = {id: this.id};

		if (this.prefix !== prefix) obj.prefix = this.prefix;
		if (this.permissions) obj.permissions = this.permissions.bitfield;
		if (this.disabled !== false) obj.disabled = this.disabled;
		for (let {name, val, func} of confProp) {
			if (val() !== undefined) obj[name] = func(this[name]);
		}
		if (Object.getOwnPropertyNames(this).length > 1) return obj;
		return;
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
module.exports.register = function registerConfig (name, type, defaultVal, func) {
	let internal;

	name = String(name);
	if (typeof type !== 'function') {
		log.error(time(), 'Error registering', name, '; constructor not passed for type');
		return;
	}
	switch (type) {
		// Only primative types should exist between here and the break
		case String:
		case Number:
		case Boolean:

		func = (val) => val;
		if (typeof defaultVal !== type.name.toLowerCase()) {
			log.warn('Default value of', name, 'not of the same type, setting to', '"' + type() + '"', 'instead');
			defaultVal = type(); internal = type();
		}
		Object.defineProperty(config.prototype, name, {
			set (val) {
				log.debug(time(), 'Setting config:', this.id, name);
				if (val !== undefined) internal = type(val);
				else internal = undefined;

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get () {
				let saved = this.saved ? this.saved(name) : undefined;
				log.debug(time(), 'Getting config:', this.id, name);
				return internal || saved || defaultVal;
			}
		});
		break;

		// Default conversion functions for certain object types can be added here
		case Object: if (!func) func = (val) => val;
		case Array: if (!func) func = (val) => val;
		case Map: if (!func) func = (val) => [...val];
		case Set: if (!func) func = (val) => [...val];
		case Permissions: if (!func) func = (val) => val.bitfield;
		default:
		if (!defaultVal instanceof type) {
			log.warn('Default value of', name, 'not an instance of,', type.name, ', setting to undefined instead');
			defaultVal = undefined;
		}
		Object.defineProperty(config.prototype, name, {
			set (val) {
				log.debug(time(), 'Setting config:', this.id, name);
				if (val !== undefined && !val instanceof type) internal = new type(val);
				else if (val !== undefined) internal = val;
				else internal = undefined;

				saveConfig(this).catch(e => {
					log.error(time(), 'Unable to save config for', this.id);
					log.error(e.toString());
					log.debug(e.stack);
				});
			},
			get () {
				let saved = this.saved ? this.saved(name) : undefined;
				log.debug(time(), 'Getting config:', this.id, name);
				return internal || saved || defaultVal;
			}
		});
	}
	confProp.add({name: name, val: () => internal, func: func()});
	log.debug(time(), 'Should have registered property:', name, 'type', type.name);
}
