const { useHooks } = require("zihooks");
const config = useHooks.get("config");

module.exports = {
	name: "trackStart",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, track) => {
		const playerGui = useHooks.get("functions").get("playerGui");
		if (!playerGui) return;

		const Gui = await playerGui.execute({ player, tracks: track });

		try {
			await player.userdata.mess.edit(Gui);
		} catch (e) {
			console.log(e);
			player.userdata.mess = await player.userdata.channel.send(Gui);
		}

		// Status of voice channel
		if (config.PlayerConfig?.changeStatus) {
			const status = `💿 Now playing: ${track.title}`;
			const { rest } = useHooks.get("client");
			rest.put(`/channels/${player?.connection?.joinConfig.channelId}/voice-status`, { body: { status } }).catch((e) => {
				console.log(e);
			});
		}
	},
};
