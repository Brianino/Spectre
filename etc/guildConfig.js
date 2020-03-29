const log = require('debug-logger')('guild-config');
const config = require('../config.json');
const time = require('./time.js');
const fs = require('fs').promises;

const cache = new Map(), sym = {
	prfx: Symbol('command prefix'),
	perm: Symbol('permissions map'),
	disa: Symbol('disabled com map'),
	json: Symbol('to json functions'),
	empt: Symbol('empty prop functions'),
	dmdn: Symbol('default number of messages to erase'),
	mlim: Symbol('message search limit'),
	cOld: Symbol('clear old messages'),
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

module.exports.configLoad = load;
module.exports.guildConfig = getGuild;

function getGuild (id) {
	let res

	if (typeof id === 'object') id = id.id;

	res = cache.get(id);
	if (!res) cache.set(id, res = new guildConfig(id, {id}));

	return res;
}

class guildConfig {
	constructor (id, {id: fallbackid, prefix, perms, disabled = [], ...obj}) {
		Object.defineProperties(this, {
			id: {value: id || fallbackid},
			[sym.json]: {value: []},
			[sym.empt]: {value: []},
		});
		this._internal(sym.prfx, {prefix});
		this._internal(sym.perm, {perms: new Map(perms)}, () => [...this[sym.perm]], () => this[sym.perm].size);
		this._internal(sym.disa, {disabled: Array.from(disabled)}, undefined, () => this[sym.disa].length);
		this._internal(sym.dmdn, {defClear: obj.defClear});
		this._internal(sym.mlim, {msgLimit: obj.msgLimit});
		this._internal(sym.cOld, {msgOld: obj.msgOld});
	}

	set prefix (value) {
		value = String(value).replace(/ /g, '');
		if (value === '') value = undefined;
		if (value !== this[sym.prfx]) {
			this[sym.prfx] = value;
			saveConfig(this).catch(e => log.error(time(), 'Unable to save file:', e.toString()));
		}
	}

	get prefix () {return this[sym.prfx] || config.prefix}

	set perms ([command, ...permissions]) {
		let old = this[sym.perm].get(command), same = true;

		if (old && old.length === permissions.length) {
			for (let val of old) {
				if (!permissions.includes(val)) {
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

	get perms () {return [...this[sym.perm]]}

	set disabled (commands) {
		let same = true;

		if (!commands instanceof Array) return;
		if (commands.length === this[sym.disa].length) {
			for (let val of this[sym.disa]) {
				if (!commands.includes(val)) {
					same = false;
					break;
				}
			}
		} else same = false;
		if (!same) {
			log.debug(time(), 'Commands are:', commands);
			if (commands.length === 0) {
				log.debug(time(), 'Removing disabled commands config for guild -', this.id);
				this[sym.disa] = [];
			} else this[sym.disa] = commands;
			saveConfig(this).catch(e => log.error(time(), 'Unable to save file:', e.toString()));
		}
	}

	get disabled () {return [...this[sym.disa]]}

	set defaultClear (input) {
		if (!isNaN(input = Number(input))) {
			this[sym.dmdn] = input;
		}
	}

	get defaultClear () {return this[sym.dmdn] || 50}

	set messageLimit (input) {
		if (!isNaN(input = Number(input))) {
			this[sym.mlim] = input;
		}
	}

	get messageLimit () {return this[sym.mlim] || 1000}

	set clearOld (input) {this[sym.cOld] = Boolean(input)}

	get clearOld () {return this[sym.cOld] || true}

	isEmpty() {
		for (let func of this[sym.empt]) {
			if (func()) return false;
		}
		return true;
	}

	toJSON () {
		let obj = {id: this.id};
		for (let [name, func] of this[sym.json]) {
			obj[name] = func();
		}
		return JSON.stringify(obj);
	}

	_internal (prop, val, jsonFunc, emptyFunc) {
		let [name] = Object.getOwnPropertyNames(val);

		this[prop] = val[name];
		if (!jsonFunc) jsonFunc = () => this[prop];
		if (!emptyFunc) emptyFunc = () => this[prop];
		this[sym.json].push([name, jsonFunc]);
		this[sym.empt].push(emptyFunc);
	}
}
