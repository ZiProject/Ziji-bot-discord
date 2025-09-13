const { useClient, useLogger } = require("@zibot/zihooks");

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
		const client = useClient();
		client.errorLog("**Player playerError**");
		client?.errorLog(error.message);
		client?.errorLog(track.url);
		useLogger().error(error);
	},
};
