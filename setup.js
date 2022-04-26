
import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';

const configUrl = new URL('./config.json', import.meta.url),
	configTemplate = {
		"token": "",
		"owner": "",
		"prefix": "+",
		"login_retries": 3
	};

let changed = false, config;

try {
	let data = await readFile(configUrl);
	config = JSON.parse(data);
	console.log('Configuration file found');
} catch (e) {
	switch (e.code) {
		case 'ENOENT': config = {}; break;
		case 'EACCES': 
			console.error('Cannot access config file, please change file permissions');
			process.exit(1);
			
		default:
			console.error('Error trying to read config file:', e);
			process.exit(2);
	}
}
	

for (const prop of Object.getOwnPropertyNames(configTemplate)) {
	if (!Object.hasOwn(config, prop)) {
		console.log('Configuration is missing', prop)
		config[prop] = configTemplate[prop];
		changed = true;
	}
}

// write config if changed
if (changed) {
	try {
		await writeFile(configUrl, JSON.stringify(config, null, '\t'));
		console.log('Configuration file updated');
	} catch (e) {
		console.error('Unable to write config file:', e);
	}
}
