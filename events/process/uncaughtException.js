const { useHooks } = require("zihooks");
const client = useHooks.get("client");

module.exports = {
	name: "uncaughtException",
	type: "process",
	execute: async (error) => {
		useHooks.get("logger").error("Uncaught exception:", error);
		client?.errorLog(`Uncaught exception: **${error.message}**`);
		client?.errorLog(error.stack);
	},
};
