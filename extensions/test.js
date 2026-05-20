const { useHooks } = require("zihooks");
const util = require("node:util");

/**
 * This extension file run at bot started.
 */

module.exports.data = {
	name: "test",
	type: "extension",
	enable: false,
};
/**
 *
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	// Your code here ...
	const channel = await client.channels.fetch("1504721560886313026");
	const message = await channel.messages.fetch("1506657263291465828");
	console.log(
		util.inspect(message.components, {
			depth: null,
			colors: true,
			showHidden: false,
		}),
	);
};
