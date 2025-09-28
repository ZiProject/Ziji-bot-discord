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

class StartupManager {
	constructor(config) {
		this.config = config ?? {};
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.updateChecker = new UpdateChecker();
		this.createFile("./jsons");
	}

	getLogger() {
		return this.logger;
	}

	loadFiles(directory, collection, app = null) {
		return this.loader.loadFiles(directory, collection, app);
	}

	loadEvents(directory, target, app = null) {
		return this.loader.loadEvents(directory, target, app);
	}

	createFile(directory) {
		return this.loader.createDirectory(directory);
	}

	checkForUpdates() {
		return this.updateChecker.start(this.logger);
	}
}

module.exports = { StartupManager };
