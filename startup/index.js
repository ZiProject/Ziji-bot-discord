const { StartupLoader } = require("./loader.js");
const { LoggerFactory } = require("./logger.js");
const { useHooks } = require("@zibot/zihooks");
const { Collection } = require("discord.js");

class StartupManager {
	constructor(client) {
		this.config = this.initCongig();
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.createFile("./jsons");
		this.client = client;
	}

	initCongig() {
		try {
			this.config = require("../config");
		} catch {
			console.warn("No config file found, using default configuration.");
			this.config = require("./defaultconfig");
		}

		useHooks.set("config", this.config);
		return this.config;
	}

	getConfig() {
		return this.config;
	}

	getLogger() {
		return this.logger;
	}

	loadFiles(directory, collection) {
		return this.loader.loadFiles(directory, collection);
	}

	loadEvents(directory, target) {
		return this.loader.loadEvents(directory, target);
	}

	createFile(directory) {
		return this.loader.createDirectory(directory);
	}

	initHooks() {
		useHooks.set("config", this.config);
		useHooks.set("client", this.client);
		useHooks.set("welcome", new Collection());
		useHooks.set("cooldowns", new Collection());
		useHooks.set("responder", new Collection());
		useHooks.set("commands", new Collection());
		useHooks.set("functions", new Collection());
		useHooks.set("extensions", new Collection());
		useHooks.set("logger", this.logger);
	}
}

module.exports = { StartupManager };
