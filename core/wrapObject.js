"use strict";

function wrapObject (obj, wrapper) {
	return new Proxy (wrapper, {
		get: (target, prop) => {
			if (Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(obj), prop)){
				let val = Reflect.get(obj, prop);
				if (val instanceof Function)
					return val.bind(obj);
				else
					return val;
			} else {
				return Reflect.get(target, prop);
			}
		},
		set: (target, prop, value) => {
			if (Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(obj), prop))
				return Reflect.set(obj, prop, value, obj);
			else
				return Reflect.set(target, prop, value);
		}
	});
}

export default wrapObject;