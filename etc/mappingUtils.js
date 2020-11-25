const log = require('./logger.js')('guild-config');
const {parseBool, time} = require('./utilities.js');
const {Permissions} = require('discord.js');

module.exports = class mappingUtilties {
	static getConverter (type) {
		let typeName = String(type).toLowerCase();
		if (typeName in this)
			return this[typeName];
		else
			throw new TypeError('no mapping function for type ' + typeName);
	}

	static asString (type, input) {
		let typeName = String(type.toLowerCase());

		if (typeName in this) {
			return JSON.stringify(this[typeName].toJson(input));
		} else
			throw new TypeError('no mapping function for type ' + typeName);
	}

	static asObject (type, input) {
		let typeName = String(type.toLowerCase());

		if (typeName in this) {
			if (typeof input === 'string')
				return this[typeName].from(JSON.parse(input));
			else
				return this[typeName].from(input);
		} else
			throw new TypeError('no mapping function for type ' + typeName);
	}

	static get auto () {
		return {
			toJson: (input) => {
				let typeName = input.constructor.name.toLowerCase();
				return {
					type: typeName,
					value: this.getConverter(typeName).toJson(input),
				}
			},
			from: ({type, value}) => {
				return this.getConverter(type).from(value);
			}
		}
	}

	static get string () {
		return {
			toJson (input) {
				return String(input);
			},
			from (input) {
				return String(input);
			}
		}
	}

	static get boolean () {
		return {
			toJson (input) {
				return parseBool(input);
			},
			from (input) {
				return parseBool(input);
			}
		}
	}

	static get number () {
		return {
			toJson (input) {
				return Number(input);
			},
			from (input) {
				return Number(input);
			}
		}
	}

	static get object () {
		return {
			toJson: (input) => {
				let res = {};
				for (let key in input)
					res[key] = this.auto.toJson(input[key]);
				return res;
			},
			from: (input) =>  {
				let res = {};
				for (let key in input)
					res[key] = this.auto.from(input[key]);
				return res;
			}
		}
	}

	static get array () {
		return {
			toJson: (input) => input.map(this.auto.toJson),
			from: (input) => input.map(this.auto.from),
		}
	}

	static get map () {
		return {
			toJson: (input) => {
				return [...input].map(([key, val]) => [key, this.auto.toJson(val)]);
			},
			from: (input) => {
				return new Map(input.map(([key, val]) => [key, this.auto.from(val)]));
			}
		}
	}

	static get set () {
		return {
			toJson: (input) => {
				return [...input].map(val => this.auto.toJson(val));
			},
			from: (input) => {
				return new Set(input.map(val => this.auto.from(val)));
			}
		}
	}

	static get permissions () {
		return {
			toJson: (input) => input.bitfield,
			from: (input) => new Permissions(input)
		}
	}
}
