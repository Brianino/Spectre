

function wrapObject (obj, wrapper) {
	return new Proxy(wrapper, {
		get: (target, prop) => {
			if (Object.hasOwn(Object.getPrototypeOf(obj), prop)) {
				const val = Reflect.get(obj, prop);
				if (val instanceof Function)
					return val.bind(obj);
				else
					return val;
			} else {
				return Reflect.get(target, prop);
			}
		},
		set: (target, prop, value) => {
			if (Object.hasOwn(Object.getPrototypeOf(obj), prop))
				return Reflect.set(obj, prop, value, obj);
			else
				return Reflect.set(target, prop, value);
		},
	});
}

export default wrapObject;
