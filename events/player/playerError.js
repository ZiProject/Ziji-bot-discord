const { useHooks } = require("zihooks");

module.exports = {
	name: "playerError",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {Error} error
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, error, track) => {
		const client = useHooks.get("client");
		client.errorLog("**Player playerError**");
		client?.errorLog(error?.message);
		client?.errorLog(track?.url);
		useHooks.get("logger").error(error);
	},
};
