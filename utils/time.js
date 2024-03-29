/**
 * Gets the current time nicely formatted
 * @function time
 * @memberof utils
 *
 * @return {string} the current date formatted in a specific way for logging
*/
const time = (function setupTimeFormatter () {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'GMT',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
	return (date = new Date()) => {
		return formatter.format(date);
	};
})();

export default time;
