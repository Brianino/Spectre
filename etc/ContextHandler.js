'use strict';
/** @module ContextHandler */
const log = require('../utils/logger.js')('context-handler');
const {Client, Guild, Collection} = require('discord.js');
const listener = require('./ProxyListener.js');

const sym = {
	guilds: Symbol('get guild function'),
	dms: Symbol('get dms function'),
	listeners: Symbol('attached listeners'),
}

const retrieveObject = objMap => mod => {
	let res, group = mod.objectGroup;
	if (group) {
		res = objMap.get(group);

		if (!res) object.set(group, res = {});
	} else {
		res = {};
	}
	return res;
}

const checkGuild = guildId => obj => {
	let guild;

	if (obj instanceof Guild) guild = obj;
	else if ('guild' in obj) guild = obj.guild;
	else if (obj.message) guild = obj.message.guild;
	else if (obj instanceof Collection) {
		let temp = obj.first();

		if ('guild' in temp) guild = temp.guild;
	}

	log.debug('Guild id found is:', guild.id, 'against', guildId);
	return guild && guild.id === guildId;
}

function addFuncs ([guild, dm, empty], func) {
	if (guild && dm && !empty && (this[sym.guilds] || this[sym.dms])) return;
	if ((guild || empty) && !this[sym.guilds]) {
		log.debug('Assigning Guild function to:', this.command);
		Object.defineProperty(this, sym.guilds, {value: func});
	}
	if ((dm || empty) && !this[sym.dms]) {
		log.debug('Assigning DM function to:', this.command);
		Object.defineProperty(this, sym.dms, {value: func});
	}
}

function proxifyListener (listener, cmdObj, check) {
	function register (ev, li) {
		if (!cmdObj.hasOwnProperty(sym.listeners)) {
			cmdObj[sym.listeners] = new Map();
			cmdObj[sym.listeners].set(li, new Set([ev]));
		} else {
			let map = cmdObj[sym.listeners], evSet = map.get(li) || new Set();

			if (evSet.size === 0)
				map.set(li, evSet)
			evSet.add(ev);
		}
	}
	function unregister (ev, li) {
		if (!cmdObj.hasOwnProperty(sym.listeners)) {
			let map = cmdObj[sym.listeners], evSet = map.get(li) || new Set();

			if (evSet.size <= 1)
				map.delete(li);
			if (evSet.size > 1)
				evSet.delete(ev);
		}
	}
	// add in store for all listeners that can be used to remove them when the module gets deleted
	return new Proxy (listener, {
		get: (target, prop, receiver) => {
			let func = Reflect.get(target, prop);
			switch (prop) {
				case 'on':
				case 'once':
				case 'addListener':
				case 'prependListener':
				case 'prependOnceListener': {
					return (event, listener) => {
						register(event, listener);
						return func.call(target, event, listener, check);
					}
				}
				break;

				case 'off':
				case 'removeListener': {
					return (event, listener) => {
						unregister(event, listener);
						return func.call(target, event, listener);
					}
				}
				break;

				default:
				return func;
				break;
			}
		}
	});
}

// Disabled all shared contexes for now (need to think of a better way to do it)
// Thinking of shifting all the shared contexes to work in a way that allows a medule to pick what commands can share the context (whether that be group, or individual commands)
// Globally shared seems pointless (hmm, now that i think about it, maybe there are use cases for it but i should come up with a standard practice for them)
// Add basic objects to context (such as the module, the logger, the require)
// REPLACE VM CONTEXT WITH OBJECT.CREATE() (CREATES A NEW OBJECT USING OLD ONE AS PROTOTYPE)
// New method should allow the object itself to act as a global context, and the function to to operate under the new context object (which should allow the config var to be set)
// Commands sharing context

/**
 * @class ContextHandler
*/
module.exports = function (getConfigCallback) {
	let ctx = {
		guilds: {
			// Function that is shared between guilds
			funcMap: new WeakMap(), // Map command object to function
			// Object shared between members of the group
			objMap: new Map(),
		},
		dms: {
			// Function that is shared between dms
			funcMap: new WeakMap(), // Map command object to function
			// Object shared between members of the group
			objMap: new Map(),
		},
		all: {
			// Function that is shared between guild and dms
			funcMap: new WeakMap(),
			// Context that is shared between guild, dms and commands
			objMap: new Map(),
		}
	}, modListener = new listener(undefined, true);

	ctx.guilds.getObj = retrieveObject(ctx.guilds.objMap);
	ctx.dms.getObj = retrieveObject(ctx.dms.objMap);
	ctx.all.getObj = retrieveObject(ctx.all.objMap);
	this.setEventSource = source => {
		// check that the source is an instance of client, otherwise throw error
		if (!source instanceof Client)
			throw new Error('Emitter source needs to be a discord client');
		log.debug('Attempting to set proxy listener source');
		modListener.source = source;
	}

	this.cleanup = (cmdObj) => {
		if (cmdObj.hasOwnProperty(sym.listeners)) {
			for (let [listener, events] of cmdObj[sym.listeners])
				for (let ev of events)
					modListener.removeListener(ev, listener);
		}
	}

	this.create = (cmdObj, mainCtx) => {
		log.debug('Setting up', cmdObj.command);
		log.debug('Provided:', ...Object.keys(mainCtx));

		for (let key of Object.getOwnPropertyNames(mainCtx)) {
			log.debug('Processing:', key, 'in', cmdObj.command);
			switch (key) {
				case 'inGuild':
				addFuncs.call(cmdObj, [true, false],(() => {
					let guildMap = new Map();

					return (guildId) => {
						let runFunc = guildMap.get(guildId = String(guildId));

						if (!runFunc) {
							runFunc = (function () {
								let newObj = Object.create(cmdObj),
									proxyListener = proxifyListener(modListener, cmdObj, checkGuild(guildId)),
									globObj = ctx.guilds.getObj(cmdObj);
								// set config param on new obj here...
								if (getConfigCallback)
									Object.defineProperty(newObj, 'config', {value: getConfigCallback(guildId)});
								return mainCtx[key].call(newObj, proxyListener, globObj);
							})();
							log.debug('Wrapped guild function for:', cmdObj.command);
							guildMap.set(guildId, runFunc);
						}

						return runFunc;
					}
				})());
				break;

				case 'inAllGuilds':
				addFuncs.call(cmdObj, [true, false], () => {
					let runFunc = ctx.guilds.funcMap.get(cmdObj);

					if (!runFunc) {
						runFunc = (function () {
							let newObj = Object.create(cmdObj), globObj = ctx.guilds.getObj(cmdObj),
								proxyListener = proxifyListener(modListener, cmdObj);
							// set config param on new obj here...
							return mainCtx[key].call(newObj, proxyListener, globObj);
						})();
						log.debug('Wrapped guild global function for:', cmdObj.command);
						ctx.guilds.unique.set(cmdObj, runFunc);
					}

					return runFunc;
				});
				break;

				case 'inAllDM':
				addFuncs.call(cmdObj, [false, true], () => {
					let runFunc = ctx.dms.funcMap.get(cmdObj);

					if (!runFunc) {
						runFunc = (function () {
							let newObj = Object.create(cmdObj), globObj = ctx.dms.getObj(cmdObj),
								proxyListener = proxifyListener(modListener, cmdObj);
							// set config param on new obj here...
							return mainCtx[key].call(newObj, proxyListener, globObj);
						})();
						log.debug('Wrapped dm global function for:', cmdObj.command);
						ctx.dms.funcMap.set(cmdObj, runFunc);
					}

					return runFunc;
				});
				break;

				case 'inAll':
				addFuncs.call(cmdObj, [true, true], () => {
					let runFunc = ctx.all.funcMap.get(cmdObj);

					if (!runFunc) {
						runFunc = (function () {
							let newObj = Object.create(cmdObj), globObj = ctx.all.getObj(cmdObj),
								proxyListener = proxifyListener(modListener, cmdObj);
							// set config param on new obj here...
							return mainCtx[key].call(newObj, proxyListener, globObj);
						})();
						log.debug('Wrapped global function for:', cmdObj.command);
						ctx.all.funcMap.set(cmdObj, runFunc);
					}

					return runFunc;
				});
				break;
			}
		}
		log.debug('Adding empty functions');
		addFuncs.call(cmdObj, [false, false, true], () => {});
		log.debug('Finished processing:', cmdObj.command);

		return cmdObj;
	}

	return this;
}

module.exports.guildSymbol = sym.guilds;
module.exports.DMSymbol = sym.dms;
