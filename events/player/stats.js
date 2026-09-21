const { useHooks } = require("zihooks");
module.exports = {
	name: "stats",
	type: "Player",
	enable: useHooks.get("config").DevConfig.Player_DEBUG,

	/**
	 *
	 * @param {import("ziplayer").PlayerStats} stats
	 */
	execute: async (stats) => {
		/**
			players,
			totalPlayers: players,
			playback: {
				playing: playback.playing,
				paused: playback.paused,
				idle: playback.idle,
			},
			streams: {
				active: streams.active,
				loading: streams.loading,
			},
			queues: {
				totalTracks: queue.totalTracks,
			},
			preload: {
				active: preload.active,
			},
			transitions: {
				active: transitions.active,
			},
			leader: forward.leader,
			follower: forward.follower,
			activePlayers: playback.playing,
			pausedPlayers: playback.paused,
			connectedPlayers,
			totalTracksInQueue: queue.totalTracks,
			forwardHealthStatus: forward.healthStatus,      
		 */
		const memoryUsage = process.memoryUsage();
		useHooks
			.get("logger")
			.debug(
				`total players: ${stats.players},\n` +
					`active players: ${stats.activePlayers},\n` +
					`paused players: ${stats.pausedPlayers},\n` +
					`connected players: ${stats.connectedPlayers},\n` +
					`total tracks in queue: ${stats.totalTracksInQueue}.\n` +
					`playback: ${stats.playback.playing} playing, ${stats.playback.paused} paused, ${stats.playback.idle} idle,\n` +
					`streams: ${stats.streams.active} active, ${stats.streams.loading} loading,\n` +
					`queues: ${stats.queues.totalTracks} total tracks,\n` +
					`preload: ${stats.preload.active} active,\n` +
					`transitions: ${stats.transitions.active} active,\n` +
					`forwardHealthStatus: ${stats.forwardHealthStatus},\n` +
					`memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB used, ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB total, ${Math.round(memoryUsage.rss / 1024 / 1024)} MB rss. external: ${Math.round(memoryUsage.external / 1024 / 1024)} MB\n`,
			);
	},
};
