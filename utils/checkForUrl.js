'use strict';

const urlReg = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;
/**
 * Scans the input text for urls, and returns the matches
 * @memberof utils
 *
 * @param  {string}            text      - the input text to search for urls
 * @param  {boolean}           geMatches - if set to true, returns the matching url string
 * @param  {string}            flags     - the regex flags to use when getting matches
 * @return {(boolean|Array[])} returns either the list of matching regex results, or a boolean value
*/
function checkForUrl (text, getMatches = false, flags = '') {
	if (!getMatches) {
		return urlReg.test(text);
	} else {
		let treg = urlReg, res = [];

		if (flags) treg = new RegExp(urlReg, String(flags));

		if (treg.global || treg.sticky) {
			let temp;
			while (temp = treg.exec(text)) {
				res.push(temp);
			}
			return res;
		} else {
			return treg.exec(text);
		}
	}
}

export default checkForUrl;
