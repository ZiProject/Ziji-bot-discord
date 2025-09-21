const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "volumeChange",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {number} oldVolume
	 * @param {number} volume
	 */
	execute: async (player, oldVolume, volume) => {
		try {
			const embed = new EmbedBuilder()
				.setDescription(`:loud_sound: Volume: ${Math.floor(oldVolume ?? 0)}% → ${Math.floor(volume ?? 0)}%`)
				.setColor("Random")
				.setTimestamp();

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
