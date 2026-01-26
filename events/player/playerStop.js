const { useHooks } = require("zihooks");

module.exports = {
	name: "playerStop",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 */
	execute: async (player) => {
		const player_func = useHooks.get("functions").get("player_func");
		if (!player_func) return;
		const res = await player_func.execute({ queue });
		if (player.userdata.mess) return player.userdata.mess.edit(res).catch((e) => {});
	},
};
