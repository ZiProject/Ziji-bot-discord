const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "ttsStart",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {any} payload
	 */
	execute: async (player, payload) => {
		try {
			const preview = typeof payload === "string" ? payload : payload?.text || payload?.content || "";
			const snippet = preview ? `\n\u2063${String(preview).slice(0, 100)}${preview.length > 100 ? "..." : ""}` : "";
			const embed = new EmbedBuilder().setDescription(`:speaking_head: TTS started.${snippet}`).setColor("Random").setTimestamp();

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
