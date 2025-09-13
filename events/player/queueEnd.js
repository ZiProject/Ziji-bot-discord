const { useFunctions } = require("@zibot/zihooks");

module.exports = {
	name: "queueEnd",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 */
	execute: async (player) => {
		const player = useFunctions().get("player_func");
		if (!player) return;
		const res = await player.execute({ queue });
		if (player.userdata.mess) return player.userdata.mess.edit(res).catch((e) => {});
	},
};
