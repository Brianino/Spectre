import logger from '../core/logger.js';
import waitFor from './waitFor.js';
import _ from 'lodash';

const log = logger('Utilities'),
	{ isString, isArray } = _;

/**
 * Send a message to the specified channel
 * @memberof utils
 *
 * @param  {Channel}                channel    - the channel to send the message to
 * @param  {string|Object|Object[]} content    - the content to send, either an embed object, or multiple embeds
 * @param  {Object}
 * @prop   {string}                 wait       - the amount to time to wait before posting
 * @prop   {string}                 cleanAfter - the amount to time to wait to then delete the message;
 * @return {Object} the input string split by space with quoted groups kept together
*/
async function sendMessage (channel, content, { wait, cleanAfter, reply } = {}) {
	const tmpObj = {};
	if (isString(content))
		tmpObj.content = content;
	else if (isArray(content))
		tmpObj.embeds = content;
	else
		tmpObj.embeds = [content];

	if (reply)
		tmpObj.reply = { messageReference: reply };

	if (wait)
		await waitFor(wait);
	log.debug('Will send', tmpObj, `to channel: ${channel}, content is:`, content);
	const msg = await channel.send(tmpObj);

	if (cleanAfter) {
		await waitFor(cleanAfter);
		await msg.delete();
	}
	return msg;
}

export default sendMessage;
