const { loadFiles, loadEvents, createfile } = require("./loader.js");
const { Update } = require("./checkForUpdate");
const { logf } = require("./logger.js");
const { useConfig } = require("@zibot/zihooks");
const checkUpdate = () => Update(logger);

let config;
try {
	config = require("./../config.js");
	useConfig(config);
} catch {
	console.log("Cannot find config file, use default");
	config = require("./defaultconfig.js");
	useConfig(config);
}
const finalconfig = useConfig(config);
const logger = logf(finalconfig);
module.exports = {
	loadFiles,
	loadEvents,
	createfile,
	logger,
	config: finalconfig,
	checkUpdate,
};
