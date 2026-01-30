const { useHooks } = require("zihooks");

/**
 * This extension file run at bot started.
 */

module.exports.data = {
	name: "extensions Helper",
	type: "extension",
	enable: true,
	priority: 1, // set priority to load early 1 - 10
};
/**
 *
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	// Your code here ...
	console.log("Hello World!");
};
