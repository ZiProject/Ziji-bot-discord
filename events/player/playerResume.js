const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "playerResume",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, track) => {
		try {
			const embed = new EmbedBuilder()
				.setDescription(`:arrow_forward: Resumed: [${track?.title}](${track?.url})`)
				.setThumbnail(track?.thumbnail || null)
				.setColor("Random")
				.setTimestamp()
				.setFooter({
					text: `by: ${track?.requestedBy?.username ?? "Unknown"}`,
					iconURL: track?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
				});

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
