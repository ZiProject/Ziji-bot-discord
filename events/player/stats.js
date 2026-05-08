const { useHooks } = require("zihooks");
module.exports = {
	name: "stats",
	type: "Player",
	enable: useHooks.get("config").DevConfig.Player_DEBUG,

	/**
	 *
	 * @param {any} arg
	 */
	execute: async (stats) => {
		/**
		 * export interface PlayerStats {
            totalPlayers: number;
            activePlayers: number;
            pausedPlayers: number;
            connectedPlayers: number;
            totalTracksInQueue: number;
            }           
		 */
		useHooks
			.get("logger")
			.debug(
				`Saved ${stats.totalPlayers} total players, ` +
					`${stats.activePlayers} active players,` +
					`${stats.pausedPlayers} paused players,` +
					`${stats.connectedPlayers} connected players,` +
					`${stats.totalTracksInQueue} total tracks in queue.`,
			);
	},
};
