const { useLogger, useConfig } = require("@zibot/zihooks");
module.exports = {
	name: "debug",
	type: "Player",
	enable: useConfig().DevConfig.Player_DEBUG,

	/**
	 *
	 * @param {any} arg
	 */
	execute: async (...arg) => {
		useLogger().debug(...arg);
	},
};
