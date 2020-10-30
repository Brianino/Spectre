const log = require('./logger.js')('guild-config');
const {parseBool, time} = require('./utilities.js');
const {Permissions} = require('discord.js');

module.exports = class mappingUtilties {
	static getConverter (type) {
		let typeName = String(type.toLowerCase());
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
			toJson (input) {
				return input;
			},
			from (input) {
				return input;
			}
		}
	}

	static get array () {
		return {
			toJson: (input) => {
				return input;
			},
			from: (input) => {
				return input;
			}
		}
	}

	static get map () {
		return {
			toJson: (input) => {
				return [...input].map(([key, val]) => {
					let type = val.constructor.name;
					return [key, {
						val: this.getConverter(type).toJson(val),
						type: type
					}];
				});
			},
			from: (input) => {
				return new Map(input.map(([key, {val, type}]) => [key, this.getConverter(type).from(val)]));
			}
		}
	}

	static get set () {
		return {
			toJson: (input) => {
				return [...input].map(val => {
					let type = val.constructor.name;
					return {
						val: this.getConverter(type).toJson(val),
						type: type
					}
				});
			},
			from: (input) => {
				return new Set(input.map(({val, type}) => this.getConverter(type).from(val)));
			}
		}
	}

	static get permissions () {
		return {
			toJson: (input) => input.bitfiled,
			from: (input) => new Permissions(input)
		}
	}
}
