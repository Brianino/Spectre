module.exports = (() => {
	let formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'GMT',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	return () => {
		return formatter.format(new Date());
	}
})();
