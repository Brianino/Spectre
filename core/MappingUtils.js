import { Permissions } from 'discord.js';

class MappingUtilties {
	static getConverter (type) {
		const typeName = String(type).toLowerCase();
		if (typeName in this)
			return this[typeName];
		else
			throw new TypeError(`no mapping function for type ${typeName}`);
	}

	static asJson (type, input) {
		const typeName = String(type).toLowerCase();

		if (typeName in this)
			return this[typeName].toJson(input);
		else
			throw new TypeError(`no mapping function for type ${typeName}`);
	}

	static asObject (type, input) {
		const typeName = String(type).toLowerCase();

		if (typeName in this) {
			if (typeof input === 'string' && type !== 'string')
				return this[typeName].from(JSON.parse(input));
			else
				return this[typeName].from(input);
		} else {
			throw new TypeError(`no mapping function for type ${typeName}`);
		}
	}

	static get auto () {
		return {
			toJson: (input) => {
				const typeName = input.constructor.name.toLowerCase();
				return {
					type: typeName,
					value: this.getConverter(typeName).toJson(input),
				};
			},
			from: ({ type, value }) => {
				return this.getConverter(type).from(value);
			},
		};
	}

	static get string () {
		return {
			toJson (input) {
				return String(input);
			},
			from (input) {
				return String(input);
			},
		};
	}

	static get boolean () {
		return {
			toJson (input) {
				return !!input;
			},
			from (input) {
				return input;
			},
		};
	}

	static get number () {
		return {
			toJson (input) {
				return Number(input);
			},
			from (input) {
				return Number(input);
			},
		};
	}

	static get bigint () {
		return {
			toJson (input) {
				return input.toString();
			},
			from (input) {
				return BigInt(input);
			}
		}
	}

	static get object () {
		return {
			toJson: (input) => {
				const res = {};
				for (const key in input)
					res[key] = this.auto.toJson(input[key]);
				return res;
			},
			from: (input) =>  {
				const res = {};
				for (const key in input)
					res[key] = this.auto.from(input[key]);
				return res;
			},
		};
	}

	static get array () {
		return {
			toJson: (input) => input.map(this.auto.toJson),
			from: (input) => input.map(this.auto.from),
		};
	}

	static get map () {
		return {
			toJson: (input) => {
				return [...input].map(([key, val]) => [key, this.auto.toJson(val)]);
			},
			from: (input) => {
				return new Map(input.map(([key, val]) => [key, this.auto.from(val)]));
			},
		};
	}

	static get set () {
		return {
			toJson: (input) => {
				return [...input].map(val => this.auto.toJson(val));
			},
			from: (input) => {
				return new Set(input.map(val => this.auto.from(val)));
			},
		};
	}

	static get permissions () {
		return {
			toJson: (input) => this.bigint.toJson(input.bitfield),
			from: (input) => new Permissions(this.bigint.from(input)),
		};
	}

	static get regexp () {
		return {
			toJson: (input) => ({ source: input.source, flags: input.flags }),
			from: (input) => new RegExp(input.source, input.flags),
		};
	}
}

export default MappingUtilties;
