const { useHooks } = require("zihooks");

/**
 * This extension file run at bot started.
 */

module.exports.data = {
	name: "check",
	type: "extension",
	enable: false,
};
/**
 *
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	// Your code here ...
	const mCommandsf = useHooks.get("Mcommands");

	console.log(mCommandsf);
};
