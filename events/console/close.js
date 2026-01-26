const { useHooks } = require("zihooks");
const { getManager } = require("ziplayer");

module.exports = {
	name: "close",
	type: "console",
	enable: false,
	execute: async () => {
		const client = useHooks.get("client");
		const logger = useHooks.get("logger");
		logger.info("System is shutting down...");
		getManager().destroy();
		//delay 1s, animation loading circle
		console.log("System is shutting down...");
		for (let i = 0; i < 10; i++) {
			process.stdout.write(".");
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		console.log("\nSystem is shut down!");
		console.log("Have a great day!");
		client.destroy();
		process.exit(0);
	},
};
