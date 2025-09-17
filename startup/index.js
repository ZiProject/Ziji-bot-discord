const { StartupLoader } = require("./loader.js");
const { UpdateChecker } = require("./checkForUpdate");
const { LoggerFactory } = require("./logger.js");
const { useConfig } = require("@zibot/zihooks");

class StartupManager {
	constructor(config) {
		this.config = config ?? useConfig();
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.updateChecker = new UpdateChecker();
		this.createFile("./jsons");
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
}

module.exports = { StartupManager };
