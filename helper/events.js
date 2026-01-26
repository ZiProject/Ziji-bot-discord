const { useHooks } = require("zihooks");

/**
 * This events file run at "Events Helper" event emitted.
 * registered in index, startup/loader
 */
module.exports = {
	name: "Events Helper",
	type: "events",
	once: true, // only run once
	enable: true, // enable or disable this event

	/**
	 *
	 * @param { any } args
	 */
	execute: async (args) => {
		useHooks.get("logger").info("Events Helper executed with args:", args);
	},
};
