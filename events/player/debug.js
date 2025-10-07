const { useHooks } = require("@zibot/zihooks");
module.exports = {
	name: "debug",
	type: "Player",
	enable: useHooks.get("config").DevConfig.Player_DEBUG,

	/**
	 *
	 * @param {any} arg
	 */
	execute: async (...arg) => {
		useHooks.get("logger").debug(...arg);
	},
};
