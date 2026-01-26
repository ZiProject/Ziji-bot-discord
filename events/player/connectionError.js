const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports = {
	name: "connectionError",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {Error} error
	 */
	execute: async (player, error) => {
		// Log for diagnostics
		try {
			const client = useHooks.get("client");
			client?.errorLog?.("**Player connectionError**");
			client?.errorLog?.(error?.message || String(error));
		} catch {}
		try {
			useHooks.get("logger").error(error);
		} catch {}

		// Lightweight user feedback in the channel (auto-delete)
		try {
			const embed = new EmbedBuilder()
				.setDescription(`:warning: Connection error: ${error?.message || "Unknown error"}`)
				.setColor("Red")
				.setTimestamp();

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
