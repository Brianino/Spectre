class TwoWayMap extends Map {
	#reverseMap = new Map();

	constructor (iterable) {
		super();
		if (iterable) {
			for (const [key, val] of iterable)
				this.set(key, val);
		}
	}

	clear () {
		this.#reverseMap.clear();
		return super.clear();
	}

	delete (key) {
		const value = this.get(key);
		this.#reverseMap.delete(value);
		return super.delete(key);
	}

	deleteByValue (value) {
		const key = this.getByValue(value);
		this.#reverseMap.delete(value);
		return super.delete(key);
	}

	getByValue (value) {
		return this.#reverseMap.get(value);
	}

	hasValue (value) {
		return this.#reverseMap.has(value);
	}

	set (key, value) {
		if (this.#reverseMap.has(value))
			super.delete(this.#reverseMap.get(value));
		this.#reverseMap.set(value, key);
		return super.set(key, value);
	}

	*reverseEntries () {
		yield* this.#reverseMap;
	}
}

export default TwoWayMap;
