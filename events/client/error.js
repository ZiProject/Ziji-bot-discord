const { useHooks } = require("zihooks");
const { Events } = require("discord.js");

module.exports = {
	name: Events.Error,
	type: "events",
	/**
	 *
	 * @param { Error } error
	 */
	execute: async (error) => {
		useHooks.get("logger").error(error.message);
	},
};
