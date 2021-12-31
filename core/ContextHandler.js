'use strict';
/** @module ContextHandler */
import logger from './logger.js';
import { Client, Guild, Collection } from 'discord.js';
import ConsolidatedListener from './ConsolidatedListener.js';
import Listener from './ProxyListener.js';
const log = logger('Context-Handler');

const sym = {
	guilds: Symbol('get guild function'),
	dms: Symbol('get dms function'),
	listeners: Symbol('attached listeners'),
}

const retrieveObject = objMap => mod => {
	let res, group = mod.objectGroup;
	if (group) {
		res = objMap.get(group);

		if (!res) objMap.set(group, res = {});
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

	log.debug('Guild id found is:', guild?.id, 'against', guildId);
	return guild && guild.id === guildId;
}

function addFuncs ({guild, dm, fill}, func) {
	if (guild && dm && !fill && (this[sym.guilds] || this[sym.dms])) return;
	if (guild && !this[sym.guilds]) {
		log.debug('Assigning Guild function to:', this.command);
		Object.defineProperty(this, sym.guilds, {value: func});
	}
	if (dm && !this[sym.dms]) {
		log.debug('Assigning DM function to:', this.command);
		Object.defineProperty(this, sym.dms, {value: func});
	}
}

function proxifyListener (evListener, cmdObj, check) {
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
	return new Proxy (evListener, {
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

/**
 * @class ContextHandler
*/
function ContextHandler (getConfigCallback) {
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
	}, modListener = new Listener(undefined, true), consolidated = new ConsolidatedListener();

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
		cmdObj.revemoveFrom(consolidated);
	}

	this.create = (cmdObj, mainCtx) => {
		// Variables set to true simplify object creation.
		// Used to specify what type of function to set in addFunc
		let guild = true, dm = true, fill = true;

		log.debug('Setting up', cmdObj.command);
		log.debug('Provided:', ...Object.keys(mainCtx));
		cmdObj.setAsSourceOf(ConsolidatedListener);
		for (let key of Object.getOwnPropertyNames(mainCtx)) {
			log.debug('Processing:', key, 'in', cmdObj.command);
			switch (key) {
				case 'inGuild':
				addFuncs.call(cmdObj, {guild},(() => {
					let guildMap = new Map();

					return (guildObj) => {
						let runFunc = guildMap.get(guildObj.id), guildId = String(guildObj.id);

						if (!runFunc) {
							runFunc = (function () {
								let newObj = Object.create(cmdObj),
									proxyListener = proxifyListener(modListener, cmdObj, checkGuild(guildId)),
									globObj = ctx.guilds.getObj(cmdObj);
								// set Guild property, so that moduels within the guild context have quick access to it
								Object.defineProperty(newObj, 'Guild', {value: guildObj});
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
				addFuncs.call(cmdObj, {guild}, () => {
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
				addFuncs.call(cmdObj, {dm}, () => {
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
				addFuncs.call(cmdObj, {guild, dm}, () => {
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
		addFuncs.call(cmdObj, {guild, dm, fill}, () => {});
		// scan for events? add to the allowable emit list?
		// the above will only work if i add in the proxy a way to emit the events from the bot (as there is no way to emit on the proxy listener)
		// Will i have to add a second listener? or do i add a way to emit directly on the proxy listener? maybe by extending it???
		// Or maybe since i already register the events, i add a way to directly call them?
		log.debug('Finished processing:', cmdObj.command);

		return cmdObj;
	}

	return this;
}

export default ContextHandler;
export const GuildSymbol = sym.guilds;
export const DMSymbol = sym.dms;

