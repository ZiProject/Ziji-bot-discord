module.exports = {
	name: "playerDestroy",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 */
	execute: async (player) => {
		if (player.userdata?.mess) return player.userdata.mess.edit({ components: [] }).catch((e) => {});
	},
};
