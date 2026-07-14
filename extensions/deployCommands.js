const { useHooks } = require("zihooks");
const deploy = require("../startup/deploy");

module.exports.data = {
	name: "deployCommands",
	type: "extension",
	enable: true,
	priority: 2,
};

module.exports.execute = async (client) => {
	const config = useHooks.get("config");
	if (!config?.deploy) return;

	useHooks.get("logger")?.debug?.("Starting deployCommands...");
	await deploy(client).catch((error) => {
		useHooks.get("logger")?.error?.("Error during command deployment:", error);
	});
};
