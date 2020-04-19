module.exports.split = function (str, filterEmpty = true) {
	let groups = str.split('"'), res = [];

	groups.forEach((val, i) => {
		if (i % 2 === 0)
			res = res.concat(val.split(' ').filter(val => val !== ''));
		else res.push(val);
	});

	if (filterEmpty) res = res.filter(val => val !== '');
	return res;
}


module.exports.parseBool = function (input) {
	switch (typeof input) {
		case 'bigint':
		case 'number': return Boolean(input); break;
		case 'boolean': return input; break;
		case 'Symbol': return true; break;
		case 'object': return true; break;
		case 'null': return false; break;
		case 'undefined': return false; break;
		case 'string':
		switch (input.toLowerCase()) {
			case '':
			case 'f':
			case 'false': return false;

			default:
			case 't':
			case 'true': return true;
		}
	}
}
