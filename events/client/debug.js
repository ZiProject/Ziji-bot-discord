const { useHooks } = require("zihooks");
const { Events } = require("discord.js");

module.exports = {
	name: Events.Debug,
	type: "events",
	enable: useHooks.get("config").DevConfig.DJS_DEBUG,

	/**
	 *
	 * @param { Debug } debug
	 */
	execute: async (...debug) => {
		useHooks.get("logger").debug(...debug);
	},
};
