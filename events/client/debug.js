const { useLogger, useConfig } = require("@zibot/zihooks");
const { Events } = require("discord.js");

module.exports = {
	name: Events.Debug,
	type: "events",
	enable: useConfig().DevConfig.DJS_DEBUG,

	/**
	 *
	 * @param { Debug } debug
	 */
	execute: async (...debug) => {
		useLogger().debug(...debug);
	},
};
