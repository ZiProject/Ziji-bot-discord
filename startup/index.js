const { StartupLoader } = require("./loader.js");
const { UpdateChecker } = require("./checkForUpdate");
const { LoggerFactory } = require("./logger.js");
const { useHooks } = require("@zibot/zihooks");
const { Collection } = require("discord.js");

class StartupManager {
	constructor(client, config) {
		this.config = config ?? useHooks.get("config");
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.updateChecker = new UpdateChecker();
		this.createFile("./jsons");
		this.client = client;
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

	checkForUpdates() {
		return this.updateChecker.start(this.logger);
	}

	initHooks() {
		useHooks.set("config", this.config);
		useHooks.set("client", this.client);
		useHooks.set("welcome", new Collection());
		useHooks.set("cooldowns", new Collection());
		useHooks.set("responder", new Collection());
		useHooks.set("commands", new Collection());
		useHooks.set("functions", new Collection());
		useHooks.set("logger", this.logger);
	}
}

module.exports = { StartupManager };
