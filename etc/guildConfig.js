const log = require('debug-logger')('guild-config');
const {modules} = require('../etc/moduleLoader.js');
const config = require('../config.json');
const time = require('./time.js');
const fs = require('fs').promises;

const cache = new Map(), sym = {
	prfx: Symbol('command prefix'),
	perm: Symbol('permissions map'),

}

const load = fs.opendir('./data').then(async files => {
	for await (let file of files) {
		if (file.isFile()) {
			try {
				let tmp = await fs.readFile('./data/' + file.name);
				let id = String(file.name).split('.')[0];

				cache.set(id, new guildConfig(id, JSON.parse(tmp)));
			} catch (e) {
				log.error(time(), 'Unable to read config for', file.name);
				log.error(e.stack);
			}
		}
	}
	return cache;
}).catch(e => {
	log.error(time(), 'Unable to load data directory:', e.toString());
	log.debug(e.stack);
});

const saveConfig = (config) => {
	let name = config.id + '.json';

	log.debug(time(), 'Empty Config:', config.isEmpty());
	if (!config.isEmpty()) {
		log.debug(time(), 'Attempting to save config:', name);
		return fs.writeFile('./data/' + name, config.toJSON(), {flag: 'w'});
	} else {
		log.debug(time(), 'Deleting config:', name);
		return fs.unlink('./data/' + name);
	}
}

module.exports = (modules) => {
	exports.modules = modules;
}
module.exports.guildLoad = load;
module.exports.addGuild = (id, obj) => {
	let tmp;
	cache.set(id, tmp = new guildConfig(id, obj));
	saveConfig(id, tmp).catch(e => log.error(time(), 'Unable to save file:', e.toString()));
}

class guildConfig {
	constructor (id, {id: fallbackid, prefix, perms}) {
		Object.defineProperties(this, {
			id: {value: id || fallbackid},
			[sym.prfx]: {value: prefix, writable: true},
			[sym.perm]: {value: new Map(perms)},
		});
	}

	set prefix (value) {
		value = String(value).replace(/ /g, '');
		if (value === '') value = undefined;
		if (value !== this[sym.prfx]) {
			this[sym.prfx] = value;
			saveConfig(this).catch(e => log.error(time(), 'Unable to save file:', e.toString()));
		}
	}

	get prefix () {
		return this[sym.prfx] || config.prefix;
	}

	set perms ([command, ...permissions]) {
		let old = this[sym.perm].get(command), same = true;

		if (old) {
			for (let val of old) {
				if (permissions.indexOf(val) < 0) {
					same = false;
					break;
				}
			}
		} else same = false;
		if (!same) {
			log.debug(time(), 'Permissions are:', permissions);
			if (permissions.length === 0) {
				log.debug(time(), 'Removing permissions config for', command, 'guild -', this.id);
				this[sym.perm].delete(command);
			} else this[sym.perm].set(command, permissions);
			saveConfig(this).catch(e => log.error(time(), 'Unable to save file:', e.toString()));
		}
	}

	get perms () {
		return [...this[sym.perm]];
	}

	isEmpty() {
		return !Boolean(this[sym.perm].size && this[sym.prfx]);
	}

	toJSON () {
		return JSON.stringify({
			id: this.id,
			prefix: this[sym.prfx],
			perms: [...this[sym.perm]],
		});;
	}
}
