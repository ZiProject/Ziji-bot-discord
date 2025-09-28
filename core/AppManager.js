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

const { App } = require("./App");

/**
 * AppManager singleton để quản lý App instance toàn cục
 * @class AppManager
 */
class AppManager {
	constructor() {
		if (AppManager.instance) {
			return AppManager.instance;
		}

		this.app = null;
		AppManager.instance = this;
	}

	/**
	 * Initialize app with configuration
	 * @param {Object} options - App configuration
	 * @returns {App} App instance
	 */
	initialize(options = {}) {
		if (this.app) {
			throw new Error("App already initialized");
		}

		this.app = new App(options);
		return this.app;
	}

	/**
	 * Get app instance
	 * @returns {App} App instance
	 */
	getApp() {
		if (!this.app) {
			throw new Error("App not initialized. Call initialize() first.");
		}
		return this.app;
	}

	/**
	 * Set app instance
	 * @param {App} app - App instance
	 */
	setApp(app) {
		this.app = app;
	}

	/**
	 * Get app context for binding
	 * @returns {Object} App context object
	 */
	getContext() {
		return this.getApp().getContext();
	}

	/**
	 * Bind app to module
	 * @param {Object} module - Module to bind to
	 * @returns {Object} Module with bound app instance
	 */
	bindToModule(module) {
		return this.getApp().bindToModule(module);
	}

	/**
	 * Get specific service
	 * @param {string} service - Service name
	 * @returns {*} Service instance
	 */
	getService(service) {
		const app = this.getApp();
		const services = {
			client: app.getClient,
			cooldowns: app.getCooldowns,
			commands: app.getCommands,
			functions: app.getFunctions,
			responder: app.getResponder,
			welcome: app.getWelcome,
			giveaways: app.getGiveaways,
			manager: app.getManager,
			config: app.getConfig,
			logger: app.getLogger,
		};

		if (services[service]) {
			return services[service].call(app);
		}

		throw new Error(`Service '${service}' not found`);
	}

	/**
	 * Check if app is initialized
	 * @returns {boolean} True if app is initialized
	 */
	isInitialized() {
		return !!this.app;
	}

	/**
	 * Reset app instance
	 */
	reset() {
		this.app = null;
	}
}

// Export singleton instance
const appManager = new AppManager();
module.exports = { AppManager, appManager };
