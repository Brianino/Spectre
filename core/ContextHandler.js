'use strict';
/** @module ContextHandler */
import logger from './logger.js';
import { Client, Guild, Collection } from 'discord.js';
import ConsolidatedListener from './ConsolidatedListener.js';
import ModuleObject from './ModuleObject.js';
import Listener from './ProxyListener.js';
const log = logger('Context-Handler');

class CtxObjectBundle {
	#mainCtx;
	#moduleObject;
	#proxyListener;
	#consolidatedListener;

	constructor (mainCtx, moduleObject, proxyListener, consolidatedListener) {
		this.#mainCtx = mainCtx;
		this.#moduleObject = moduleObject;
		this.#proxyListener = proxyListener;
		this.#consolidatedListener = consolidatedListener;
	}

	get mainCtx () { return this.#mainCtx; }
	get moduleObject () { return this.#moduleObject; }
	get proxyListener () { return this.#proxyListener; }
	get consolidatedListener () { return this.#consolidatedListener; }
}

class NullContext {
	static setup () { /* Do Nothing */ }
}

class GenericContext {
	_moduleObject;
	#mainCtx;
	#proxyListener;
	#consolidatedListener;
	#globObj = {};
	#runFunc;

	constructor (ctxObjectBundle) {
		// Wrapped module object so that added properties are specific to this context
		this._moduleObject = Object.create(ctxObjectBundle.moduleObject);
		this.#proxyListener = ctxObjectBundle.proxyListener;
		this.#consolidatedListener = ctxObjectBundle.consolidatedListener;
		this.#mainCtx = ctxObjectBundle.mainCtx;
	}

	set globObj (obj) {
		this.#globObj = obj;
	}

	_setupContextSpecificProperties () {
		let keys = ['on', 'addListener', 'once', 'prependListener', 'prependOnceListener', 'off', 'removeListener'];

		for (let key of keys) {
			Object.defineProperty(this._moduleObject, key, { 
				value: (event, listener) => {
					this.#consolidatedListener[key](event, listener);
				}
			});
		}
	}

	async setup (ctxKey) {
		if (!ctxKey)
			throw new Error ('Need a context key');
		if (!this.#runFunc) {
			this._setupContextSpecificProperties();
			this.#runFunc = await this.#mainCtx[ctxKey].call(this._moduleObject, this.#proxyListener, this.#globObj);
		}
		return this.#runFunc;

	}
}

class GuildContext extends GenericContext {
	// If it isn't set, it will be a function to return undefined
	#configCallback = (guildId) => undefined;
	#consolidatedListener;
	#guild;
	static contextKey = 'inGuild';

	constructor (ctxObjectBundle, guild) {
		super(ctxObjectBundle);
		if (guild instanceof Guild === false)
			throw new Error('Need an instance of guild to set up a guild specific context');
		this.#consolidatedListener = ctxObjectBundle.consolidatedListener;
		this.#guild = guild;
	}

	set configCallback (callback) {
		if (typeof callback === 'function')
			this.#configCallback = callback;
	}

	#checkGuild () {
		let guildId = this.#guild.id;
		return obj => {
			let guild;

			if (obj instanceof Guild) guild = obj;
			else if ('guild' in obj) guild = obj.guild;
			else if (obj.message) guild = obj.message.guild;
			else if (obj instanceof Collection) {
				let temp = obj.first();

				if ('guild' in temp) guild = temp.guild;
			}

			log.debug('Guild id found is:', guild?.id, 'against', guildId);
			return guild?.id === guildId;
		}
	}

	_setupContextSpecificProperties () {
		let keys = ['on', 'addListener', 'once', 'prependListener', 'prependOnceListener', 'off', 'removeListener'];

		for (let key of keys) {
			Object.defineProperty(this._moduleObject, key, { 
				value: (event, listener) => {
					this.#consolidatedListener[key](event, listener, this.#checkGuild());
				}
			});
		}
		Object.defineProperties(this._moduleObject, {
			Guild: {value: this.#guild},
			config: {get: () => this.#configCallback(this.#guild.id)},
		});
	}

	setup () {
		return super.setup(GuildContext.contextKey);
	}

	static Handler = class GuildContextHandler {
		#ctxObjectBundle;
		#configCallback;
		#store = new Map();

		constructor (ctxObjectBundle) {
			this.#ctxObjectBundle = ctxObjectBundle;
		}

		set configCallback (callback) {
			if (typeof callback === 'function')
				this.#configCallback = callback;
		}

		setup (guild) {
			let ctx = this.#store.get(guild.id);

			if (!ctx) {
				ctx = new GuildContext(this.#ctxObjectBundle, guild);
				this.#store.set(guild.id, ctx);
				ctx.configCallback = this.#configCallback;
			}
			return ctx.setup();
		}
	}
}

class AllGuildContext extends GenericContext {
	static contextKey = 'inAllGuilds';

	constructor (ctxObjectBundle) {
		super(ctxObjectBundle);
	}

	setup () {
		return super.setup(AllGuildContext.contextKey);
	}
}

class AllDMContext extends GenericContext {
	static contextKey = 'inAllDM';

	constructor (ctxObjectBundle) {
		super(ctxObjectBundle);
	}

	setup () {
		return super.setup(AllDMContext.contextKey);
	}
}

class AllContext extends GenericContext {
	static contextKey = 'inAll';

	constructor (ctxObjectBundle) {
		super(ctxObjectBundle);
	}

	setup () {
		return super.setup(AllContext.contextKey);
	}
}

class ModuleContext {
	#moduleObject;
	#proxyListener;
	#consolidatedListener;
	#configCallback;
	#guildContext = NullContext;
	#dmContext = NullContext;
	#listeners = new Map();

	constructor (cmdObj, proxyListener, consolidatedListener, configCallback) {
		if (cmdObj instanceof ModuleObject === false)
			throw new Error('Need a ModuleObject to instantiate a ModuleContext');
		this.#moduleObject = cmdObj;
		this.#proxyListener = proxyListener;
		this.#consolidatedListener = consolidatedListener;
		this.#configCallback = configCallback;
		cmdObj.setAsSourceOf(consolidatedListener);
	}

	#register(event, listener) {
		let evSet = this.#listeners.get(event);

		if (!evSet)
			this.#listeners.set(event, evSet = new Set());
		evSet.add(listener);
	}

	#unregister (event, listener) {
		let evSet = this.#listeners.get(event);

		if (evSet?.size > 1)
			evSet.delete(listener);
		else if (evSet instanceof Set)
			this.#listeners.delete(event);
	}

	#wrapListener (check) {
		return new Proxy (this.#proxyListener, {
			get: (target, prop, receiver) => {
				let func = Reflect.get(target, prop);
				switch (prop) {
					case 'on':
					case 'once':
					case 'addListener':
					case 'prependListener':
					case 'prependOnceListener': {
						return (event, listener) => {
							this.#register(event, listener);
							return func.call(target, event, listener, check);
						}
					}
					break;

					case 'off':
					case 'removeListener': {
						return (event, listener) => {
							this.#unregister(event, listener);
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

	cleanup () {
		for (let [event, listeners] of this.#listeners) {
			for (let listener of listeners)
				this.#proxyListener.removeListener(event, listener);
		}
		this.#moduleObject.removeFrom(this.#consolidatedListener);
	}

	#createCtxBundle (mainCtx) {
		return new CtxObjectBundle(mainCtx, this.#moduleObject, this.#proxyListener, this.#consolidatedListener);
	}

	create (mainCtx) {
		if (AllContext.contextKey in mainCtx) {
			let context = new AllContext(this.#createCtxBundle(mainCtx));
			this.#guildContext = context;
			this.#dmContext = context;
			return
		}

		if (GuildContext.contextKey in mainCtx) {
			this.#guildContext = new GuildContext.Handler(this.#createCtxBundle(mainCtx));
			this.#guildContext.configCallback = this.#configCallback;
		} else if (AllGuildContext.contextKey in mainCtx) {
			this.#guildContext = new AllGuildContext(this.#createCtxBundle(mainCtx));
		}
		if (AllDMContext.contextKey in mainCtx) {
			this.#dmContext = new AllDMContext(this.#createCtxBundle(mainCtx));
		}
	}

	getGuildContext (guild) {
		let ctx = this.#guildContext, ctxname = ctx === NullContext? ctx.name : ctx.constructor.name;
		log.debug(`[${this.#moduleObject.command}] Returning setup for: ${ctxname} (Guild ${guild.name})`);
		return ctx.setup(guild);
	}

	getDMContext () {
		let ctx = this.#dmContext, ctxname = ctx === NullContext? ctx.name : ctx.constructor.name;
		log.debug(`[${this.#moduleObject.command}] Returning setup for: ${ctxname}`);
		return ctx.setup();
	}
}

class ContextHandler {
	#proxyListener = new Listener(undefined, true);
	#consolidated = new ConsolidatedListener();
	#moduleStore = new Map();
	#configCallback;

	constructor (configCallback) {
		this.#configCallback = configCallback;
	};

	#retrieveObject (objMap) {
		return mod => {
			let res, group = mod.objectGroup;
			if (group) {
				res = objMap.get(group);

				if (!res) objMap.set(group, res = {});
			} else {
				res = {};
			}
			return res;
		}
	}

	setEventSource (source) {
		if (!source instanceof Client)
			throw new Error('Emitter source needs to be a discord client');
		log.debug('Attempting to set proxy listener source');
		this.#proxyListener.source = source;
	}

	cleanup (cmdObj) {
		let modContext = this.#moduleStore.get(cmdObj);

		if (modContext) {
			modContext.cleanup();
			this.#moduleStore.delete(cmdObj);
		} else {
			log.warn('Attempting to clean up non existant module:', new Error().stack);
		}
	}

	create (cmdObj, mainCtx) {
		let ctx = new ModuleContext(cmdObj, this.#proxyListener, this.#consolidated, this.#configCallback);
		ctx.create(mainCtx);
		this.#moduleStore.set(cmdObj, ctx);
	}

	getContext (cmdObj) {
		let ctx = this.#moduleStore.get(cmdObj);

		if (!ctx)
			throw new Error('Module', cmdObj.command, 'hasn\'t been setup');
		return ctx;
	}
}

export default ContextHandler;

