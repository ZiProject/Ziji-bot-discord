const { useHooks } = require("zihooks");
const client = useHooks.get("client");

module.exports = {
	name: "unhandledRejection",
	type: "process",
	execute: async (error) => {
		useHooks.get("logger").error("Unhandled promise rejection:", error);
		client?.errorLog(`Unhandled promise rejection: **${error.message}**`);
		client?.errorLog(error.stack);
	},
};
