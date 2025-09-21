const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "ttsEnd",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 */
	execute: async (player) => {
		try {
			const embed = new EmbedBuilder().setDescription(`:mute: TTS ended.`).setColor("Random").setTimestamp();

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
