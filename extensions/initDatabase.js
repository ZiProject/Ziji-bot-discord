const { useHooks } = require("zihooks");
const { initDatabase } = require("../startup/prismaDB");

module.exports.data = {
	name: "initDatabase",
	type: "extension",
	enable: true,
	priority: 1,
};

module.exports.execute = async (client) => {
	useHooks.get("logger")?.debug?.("Starting initDatabase...");
	await initDatabase({ logger: useHooks.get("logger"), client });
};
