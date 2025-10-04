/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { Client, Collection } = require("discord.js");
const { GiveawaysManager } = require("discord-giveaways");
const { default: PlayerManager } = require("ziplayer");
const { TTSPlugin, YTSRPlugin, SoundCloudPlugin, YouTubePlugin, SpotifyPlugin } = require("@ziplayer/plugin");
const { lyricsExt, voiceExt } = require("@ziplayer/extension");

/**
 * @typedef {Object} AppConfig
 * @property {Object} config - Bot configuration
 * @property {Object} logger - Logger instance
 * @property {boolean} [enableGiveaways] - Enable giveaways
 * @property {string} [giveawayStorage] - Giveaway storage path
 * @property {Object} [giveawayDefaults] - Giveaway default settings
 * @property {Object} [playerConfig] - Player manager configuration
 */

/**
 * Main App class để quản lý tất cả services và state
 * @class App
 */
class App {
	/**
	 * @param {AppConfig} options - App configuration
	 */
	constructor(options = {}) {
		this.options = options;
		this.config = options.config || {};
		this.logger = options.logger || console;

		// Initialize collections
		this.cooldowns = new Collection();
		this.commands = new Collection();
		this.functions = new Collection();
		this.responder = new Collection();
		this.welcome = new Collection();

		// Initialize client
		this.client = null;

		// Initialize giveaways
		this.giveaways = null;

		// Initialize player manager
		this.manager = null;

		// Bind methods to maintain this context
		this.bindMethods();
	}

	/**
	 * Initialize giveaways manager
	 * @private
	 * @param {AppConfig} options - App configuration
	 */
	initializeGiveaways(options) {
		if (options.enableGiveaways && this.client) {
			this.giveaways = new GiveawaysManager(this.client, {
				storage: options.giveawayStorage || "./jsons/giveaways.json",
				default: {
					botsCanWin: false,
					embedColor: "Random",
					embedColorEnd: "#000000",
					reaction: "🎉",
					...options.giveawayDefaults,
				},
			});
		} else {
			this.giveaways = () => false;
		}
	}

	/**
	 * Initialize player manager
	 * @private
	 * @param {AppConfig} options - App configuration
	 */
	initializePlayerManager(options) {
		if (this.client) {
			this.manager = new PlayerManager({
				plugins: [new TTSPlugin(), new YTSRPlugin(), new YouTubePlugin(), new SoundCloudPlugin(), new SpotifyPlugin()],
				extensions: [
					new lyricsExt(),
					new voiceExt(null, {
						client: this.client,
						minimalVoiceMessageDuration: 1,
					}),
				],
				...options.playerConfig,
			});
			this.manager.create("search");
		}
	}

	/**
	 * Bind methods to maintain this context
	 * @private
	 */
	bindMethods() {
		// Bind all public methods to maintain this context
		const methods = [
			"setClient",
			"getClient",
			"getCooldowns",
			"getCommands",
			"getFunctions",
			"getResponder",
			"getWelcome",
			"getGiveaways",
			"getManager",
			"getConfig",
			"getLogger",
			"bindToModule",
		];

		methods.forEach((method) => {
			if (typeof this[method] === "function") {
				this[method] = this[method].bind(this);
			}
		});
	}

	/**
	 * Set Discord client
	 * @param {Client} client - Discord client instance
	 */
	setClient(client) {
		this.client = client;

		// Reinitialize giveaways and player manager with client
		this.initializeGiveaways(this.options);
		this.initializePlayerManager(this.options);

		// Set global context for modules to access at module level
		this.setGlobalContext();
	}

	/**
	 * Get Discord client
	 * @returns {Client} Discord client instance
	 */
	getClient() {
		return this.client;
	}

	/**
	 * Get cooldowns collection
	 * @returns {Collection} Cooldowns collection
	 */
	getCooldowns() {
		return this.cooldowns;
	}

	/**
	 * Get commands collection
	 * @returns {Collection} Commands collection
	 */
	getCommands() {
		return this.commands;
	}

	/**
	 * Get functions collection
	 * @returns {Collection} Functions collection
	 */
	getFunctions() {
		return this.functions;
	}

	/**
	 * Get responder collection
	 * @returns {Collection} Responder collection
	 */
	getResponder() {
		return this.responder;
	}

	/**
	 * Get welcome collection
	 * @returns {Collection} Welcome collection
	 */
	getWelcome() {
		return this.welcome;
	}

	/**
	 * Get giveaways manager
	 * @returns {GiveawaysManager|Function} Giveaways manager or false function
	 */
	getGiveaways() {
		return this.giveaways;
	}

	/**
	 * Get player manager
	 * @returns {PlayerManager} Player manager instance
	 */
	getManager() {
		return this.manager;
	}

	/**
	 * Get configuration
	 * @returns {Object} Configuration object
	 */
	getConfig() {
		return this.config;
	}

	/**
	 * Get logger
	 * @returns {Object} Logger instance
	 */
	getLogger() {
		return this.logger;
	}

	/**
	 * Set global context for modules to access at module level
	 * @private
	 */
	setGlobalContext() {
		// Create a global context object that modules can access
		global.ModuleContext = {
			app: this,
			client: this.client,
			cooldowns: this.cooldowns,
			commands: this.commands,
			functions: this.functions,
			responder: this.responder,
			welcome: this.welcome,
			giveaways: this.giveaways,
			manager: this.manager,
			config: this.config,
			logger: this.logger,
		};
	}

	/**
	 * Bind app instance to module for this context
	 * @param {Object} module - Module to bind to
	 * @returns {Object} Module with bound app instance
	 */
	bindToModule(module) {
		if (!module || typeof module !== "object") {
			return module;
		}

		module.app = this;
		module.client = this.client;
		module.cooldowns = this.cooldowns;
		module.commands = this.commands;
		module.functions = this.functions;
		module.responder = this.responder;
		module.welcome = this.welcome;
		module.giveaways = this.giveaways;
		module.manager = this.manager;
		module.config = this.config;
		module.logger = this.logger;

		// Bind all functions in the module to maintain this context
		this.bindModuleFunctions(module);

		// Call onBind if it exists to allow modules to access context immediately
		if (typeof module.onBind === "function") {
			try {
				module.onBind();
			} catch (error) {
				// Ignore errors in onBind
			}
		}

		return module;
	}

	/**
	 * Bind all functions in module to maintain this context
	 * @param {Object} module - Module to bind functions
	 * @private
	 */
	bindModuleFunctions(module) {
		const visited = new WeakSet();
		const nativeTypes = new Set([
			"Object", "Array", "Function", "RegExp", "Date", "Error", "Promise",
			"ReadableState", "WritableState", "TransformState", "DuplexState",
			"Buffer", "Map", "Set", "WeakMap", "WeakSet"
		]);

		const bindFunctions = (obj, depth = 0) => {
			// Prevent infinite recursion and limit depth
			if (visited.has(obj) || depth > 2 || !obj || typeof obj !== "object") {
				return;
			}

			// Skip native objects and prototypes
			if (obj.constructor && nativeTypes.has(obj.constructor.name)) {
				return;
			}

			// Skip prototype objects
			if (obj === Object.prototype || obj === Function.prototype || obj === Array.prototype) {
				return;
			}

			visited.add(obj);

			try {
				// Use Object.entries for better performance
				for (const [key, value] of Object.entries(obj)) {
					if (typeof value === "function") {
						// Skip native functions and bound functions
						if (!value.toString().includes("[native code]") && !value.toString().includes("bound ")) {
							try {
								obj[key] = value.bind(module);
							} catch {
								// Skip if binding fails
							}
						}
					} else if (value && typeof value === "object" && !Array.isArray(value)) {
						// Recursively bind nested objects
						bindFunctions(value, depth + 1);
					}
				}
			} catch {
				// Skip if any error occurs
			}
		};

		bindFunctions(module);
	}

	/**
	 * Get app context for binding
	 * @returns {Object} App context object
	 */
	getContext() {
		return {
			app: this,
			client: this.client,
			cooldowns: this.cooldowns,
			commands: this.commands,
			functions: this.functions,
			responder: this.responder,
			welcome: this.welcome,
			giveaways: this.giveaways,
			manager: this.manager,
			config: this.config,
			logger: this.logger,
		};
	}

	/**
	 * Initialize app with client
	 * @param {Client} client - Discord client instance
	 */
	async initialize(client) {
		this.setClient(client);
		this.logger.info("App initialized successfully");
	}

	/**
	 * Get app status
	 * @returns {Object} App status information
	 */
	getStatus() {
		return {
			client: !!this.client,
			clientReady: this.client?.isReady() || false,
			cooldowns: this.cooldowns.size,
			commands: this.commands.size,
			functions: this.functions.size,
			responder: this.responder.size,
			welcome: this.welcome.size,
			giveaways: !!this.giveaways,
			manager: !!this.manager,
			config: !!this.config,
			logger: !!this.logger,
		};
	}
}

module.exports = { App };
