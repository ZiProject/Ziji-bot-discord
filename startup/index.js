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

const { StartupLoader } = require("./loader.js");
const { UpdateChecker } = require("./checkForUpdate");
const { LoggerFactory } = require("./logger.js");
const { MemoryManager, PerformanceMonitor } = require("../utils/performance.js");

class StartupManager {
	constructor(config) {
		this.config = config ?? {};
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.updateChecker = new UpdateChecker();
		
		// Initialize performance monitoring
		this.memoryManager = new MemoryManager();
		this.performanceMonitor = new PerformanceMonitor();
		
		// Start memory management
		this.memoryManager.startAutoGC();
		
		this.createFile("./jsons");
	}

	getLogger() {
		return this.logger;
	}

	loadFiles(directory, collection, app = null) {
		this.performanceMonitor.startTimer('loadFiles');
		const result = this.loader.loadFiles(directory, collection, app);
		const duration = this.performanceMonitor.endTimer('loadFiles');
		this.logger.info(`Loaded files from ${directory} in ${duration.toFixed(2)}ms`);
		return result;
	}

	loadEvents(directory, target, app = null) {
		this.performanceMonitor.startTimer('loadEvents');
		const result = this.loader.loadEvents(directory, target, app);
		const duration = this.performanceMonitor.endTimer('loadEvents');
		this.logger.info(`Loaded events from ${directory} in ${duration.toFixed(2)}ms`);
		return result;
	}

	createFile(directory) {
		return this.loader.createDirectory(directory);
	}

	checkForUpdates() {
		return this.updateChecker.start(this.logger);
	}

	/**
	 * Get performance metrics
	 */
	getPerformanceMetrics() {
		return {
			memory: this.memoryManager.getMemoryStats(),
			performance: this.performanceMonitor.getAllMetrics()
		};
	}

	/**
	 * Cleanup resources
	 */
	cleanup() {
		this.memoryManager.stopAutoGC();
		this.logger.info('Startup manager cleanup completed');
	}
}

module.exports = { StartupManager };
