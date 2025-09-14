const { useClient, useFunctions, useConfig } = require("@zibot/zihooks");
const config = useConfig();

module.exports = {
	name: "trackStart",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, track) => {
		const player_func = useFunctions().get("player_func");
		if (!player_func) return;

		const playerGui = await player_func.execute({ player, tracks: track });

		try {
			await player.userdata.mess.edit(playerGui);
		} catch {
			player.userdata.mess = await player.userdata.channel.send(playerGui);
		}

		// Status of voice channel
		if (config.PlayerConfig?.changeStatus) {
			const status = `💿 Now playing: ${track.title}`;
			const { rest } = useClient();
			rest.put(`/channels/${player?.connection?.joinConfig.channelId}/voice-status`, { body: { status } }).catch((e) => {
				console.log(e);
			});
		}
	},
};
