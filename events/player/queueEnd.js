const { useFunctions } = require("@zibot/zihooks");

module.exports = {
	name: "queueEnd",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 */
	execute: async (player) => {
		const player_func = useFunctions().get("player_func");
		if (!player_func) return;
		const res = await player_func.execute({ player });
		if (player.userdata.mess) return player.userdata.mess.edit(res).catch((e) => {});
	},
};
