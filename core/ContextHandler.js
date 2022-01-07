import logger from './logger.js';
import { Client, Guild, Collection } from 'discord.js';
import ConsolidatedListener from './ConsolidatedListener.js';
import ModuleObject from './ModuleObject.js';
import Listener from './ProxyListener.js';
import wrapObject from './wrapObject.js';
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
	static set globObj (input) { /* Do Nothing */ }
	static setup () { /* Do Nothing */ }
}

class GenericContext {
	#moduleObject;
	#moduleChild;
	#proxyListener;
	#consolidatedListener;
	#globObj = {};
	#mainCtx;
	#runFunc;

	constructor (ctxObjectBundle) {
		this.#moduleObject = ctxObjectBundle.moduleObject;
		this.#proxyListener = ctxObjectBundle.proxyListener;
		this.#consolidatedListener = ctxObjectBundle.consolidatedListener;
		this.#mainCtx = ctxObjectBundle.mainCtx;
	}

	set globObj (obj) {
		this.#globObj = obj;
	}

	get command () { return this.#moduleObject.command; }

	#wrapModuleObject () {
		if (!this.#moduleChild) {
			const props = this._setupContextSpecificProperties();

			this.#moduleChild = wrapObject(this.#moduleObject, props);
		}
		return this.#moduleChild;
	}

	_setupContextSpecificProperties () {
		const keys = ['on', 'addListener', 'once', 'prependListener', 'prependOnceListener', 'off', 'removeListener'], res = {};

		for (const key of keys) {
			log.debug(`[${this.command}] Binding ${key} of consolidated listener to module object property`);
			Object.defineProperty(res, key, {
				value: (event, listener) => {
					this.#consolidatedListener[key](event, listener);
				},
			});
		}
		return res;
	}

	_getCheck () {
		log.debug(`[${this.command}] No check function (${this.constructor.name})`);
		return undefined;
	}

	async setup (ctxKey) {
		if (!ctxKey)
			throw new Error('Need a context key');
		if (!this.#runFunc)
			this.#runFunc = await this.#mainCtx[ctxKey].call(this.#wrapModuleObject(), this.#proxyListener(this._getCheck()), this.#globObj);
		log.debug(`[${this.command}] Setting up ${ctxKey}`);
		return this.#runFunc;

	}
}

class GuildContext extends GenericContext {
	#consolidatedListener;
	// If it isn't set, it will be a function to return undefined
	#configCallback;
	#guild;

	static contextKey = 'inGuild';
	constructor (ctxObjectBundle, guild) {
		super(ctxObjectBundle);
		if (guild instanceof Guild === false)
			throw new Error('Need an instance of guild to set up a guild specific context');
		this.#consolidatedListener = ctxObjectBundle.consolidatedListener;
		this.#configCallback = () => undefined;
		this.#guild = guild;
	}

	set configCallback (callback) {
		if (typeof callback === 'function')
			this.#configCallback = callback;
	}

	#checkGuild () {
		const guildId = this.#guild.id;
		return obj => {
			let guild;

			if (obj instanceof Guild) {
				guild = obj;
			} else if ('guild' in obj) {
				guild = obj.guild;
			} else if (obj.message) {
				guild = obj.message.guild;
			} else if (obj instanceof Collection) {
				const temp = obj.first();

				if ('guild' in temp)
					guild = temp.guild;
			}

			log.debug('Guild id found is:', guild?.id, 'against', guildId);
			return guild?.id === guildId;
		};
	}

	_setupContextSpecificProperties () {
		const res = super._setupContextSpecificProperties();
		Object.defineProperties(res, {
			Guild: { value: this.#guild },
			config: { get: () => this.#configCallback(this.#guild.id) },
		});
		log.debug(`[${this.command}] Properties for ${this.#guild.name} setup`);
		return res;
	}

	_getCheck () {
		log.debug(`[${this.command}] Returning bound check for guild ${this.#guild.name} (${this.constructor.name})`);
		return this.#checkGuild();
	}

	setup () {
		return super.setup(GuildContext.contextKey);
	}

	static Handler = class GuildContextHandler {
		#ctxObjectBundle;
		#configCallback;
		#store = new Map();
		#globObj = {};

		constructor (ctxObjectBundle) {
			this.#ctxObjectBundle = ctxObjectBundle;
		}

		set configCallback (callback) {
			if (typeof callback === 'function')
				this.#configCallback = callback;
		}

		set globObj (obj) {
			this.#globObj = obj;
		}

		setup (guild) {
			let ctx = this.#store.get(guild.id);

			if (!ctx) {
				ctx = new GuildContext(this.#ctxObjectBundle, guild);
				this.#store.set(guild.id, ctx);
			}
			ctx.configCallback = this.#configCallback;
			ctx.globObj = this.#globObj;
			return ctx.setup();
		}
	};
}

class AllGuildContext extends GenericContext {
	static contextKey = 'inAllGuilds';

	setup () {
		return super.setup(AllGuildContext.contextKey);
	}
}

class AllDMContext extends GenericContext {
	static contextKey = 'inAllDM';

	setup () {
		return super.setup(AllDMContext.contextKey);
	}
}

class AllContext extends GenericContext {
	static contextKey = 'inAll';

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

	#register (event, listener) {
		let evSet = this.#listeners.get(event);

		if (!evSet)
			this.#listeners.set(event, evSet = new Set());
		evSet.add(listener);
	}

	#unregister (event, listener) {
		const evSet = this.#listeners.get(event);

		if (evSet?.size > 1)
			evSet.delete(listener);
		else if (evSet instanceof Set)
			this.#listeners.delete(event);
	}

	#wrapListener (check) {
		log.debug(`[${this.#moduleObject.command}] Wrapped Listener (${typeof check})`);
		return new Proxy(this.#proxyListener, {
			get: (target, prop) => {
				const func = Reflect.get(target, prop);
				switch (prop) {
					case 'on':
					case 'once':
					case 'addListener':
					case 'prependListener':
					case 'prependOnceListener': {
						return (event, listener) => {
							this.#register(event, listener);
							return func.call(target, event, listener, check);
						};
					}

					case 'off':
					case 'removeListener': {
						return (event, listener) => {
							this.#unregister(event, listener);
							return func.call(target, event, listener);
						};
					}

					default:
						return func;
				}
			},
		});
	}

	set globObj ({ Guild, DM, All }) {
		if (this.#guildContext instanceof AllContext) {
			this.#guildContext.globObj = All;
		} else {
			this.#guildContext.globObj = Guild;
			this.#dmContext.globObj = DM;
		}
	}

	cleanup () {
		for (const [event, listeners] of this.#listeners) {
			for (const listener of listeners)
				this.#proxyListener.removeListener(event, listener);
		}
		this.#moduleObject.removeFrom(this.#consolidatedListener);
	}

	#createCtxBundle (mainCtx) {
		return new CtxObjectBundle(mainCtx, this.#moduleObject, this.#wrapListener.bind(this), this.#consolidatedListener);
	}

	create (mainCtx) {
		if (AllContext.contextKey in mainCtx) {
			const context = new AllContext(this.#createCtxBundle(mainCtx));
			this.#guildContext = context;
			this.#dmContext = context;
			return;
		}

		if (GuildContext.contextKey in mainCtx) {
			this.#guildContext = new GuildContext.Handler(this.#createCtxBundle(mainCtx));
			this.#guildContext.configCallback = this.#configCallback;
		} else if (AllGuildContext.contextKey in mainCtx) {
			this.#guildContext = new AllGuildContext(this.#createCtxBundle(mainCtx));
		}

		if (AllDMContext.contextKey in mainCtx)
			this.#dmContext = new AllDMContext(this.#createCtxBundle(mainCtx));
	}

	getGuildContext (guild) {
		return this.#guildContext.setup(guild);
	}

	getDMContext () {
		return this.#dmContext.setup();
	}
}

class ContextHandler {
	#configCallback;
	#proxyListener = new Listener(undefined, true);
	#consolidated = new ConsolidatedListener();
	#moduleStore = new Map();
	#globObjStore = new Map();

	constructor (configCallback) {
		this.#configCallback = configCallback;
	}

	/* The global object is an object that is shared between guilds or dm's
	 * members of the same object group (can be set by the module using the object group setter)
	 * also share the same global object (guild and dm)
	 */
	#setupGlobalObject (cmdObj, ctx) {
		if (cmdObj.objectGroup) {
			let tmp = this.#globObjStore.get(cmdObj.objectGroup);

			if (!tmp) {
				tmp = { Guild: {}, DM: {}, All: {}};
				this.#globObjStore.set(cmdObj.objectGroup, tmp);
			}
			ctx.globObj = tmp;
		}
	}

	setEventSource (source) {
		if (source instanceof Client === false)
			throw new Error('Emitter source needs to be a discord client');
		log.debug('Attempting to set proxy listener source');
		this.#proxyListener.source = source;
	}

	cleanup (cmdObj) {
		const modContext = this.#moduleStore.get(cmdObj);

		if (modContext) {
			log.info('Cleaning up module', cmdObj.command, 'context');
			modContext.cleanup();
			this.#moduleStore.delete(cmdObj);
		} else {
			log.warn('Attempting to clean up non existant module:', new Error().stack);
		}
	}

	create (cmdObj, mainCtx) {
		const ctx = new ModuleContext(cmdObj, this.#proxyListener, this.#consolidated, this.#configCallback);
		ctx.create(mainCtx);
		this.#moduleStore.set(cmdObj, ctx);
		this.#setupGlobalObject(cmdObj, ctx);
	}

	getContext (cmdObj) {
		const ctx = this.#moduleStore.get(cmdObj);

		if (!ctx)
			throw new Error('Module', cmdObj.command, 'hasn\'t been setup');
		return ctx;
	}
}

export default ContextHandler;

