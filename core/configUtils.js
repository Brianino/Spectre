import { promises as fs } from 'fs';

const config = JSON.parse(await fs.readFile('./config.json'));

function getConfig () {
	return config;
}

export { getConfig as default, getConfig };
