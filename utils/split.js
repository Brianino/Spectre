/**
 * Split a string up whilst keeping anything within double quotes grouped
 * @memberof utils
 *
 * @param  {string}  str         - the input string to split
 * @param  {boolean} filterEmpty - when true empty groups are removed
 * @return {string[]} the input string split by space with quoted groups kept together
*/
function split (str, filterEmpty = true) {
	const groups = str.split('"');
	let res = [];

	groups.forEach((val, i) => {
		if (i % 2 === 0)
			res = res.concat(val.split(' ').filter(val => val !== ''));
		else
			res.push(val);
	});

	if (filterEmpty)
		res = res.filter(val => val !== '');
	return res;
}

export default split;
