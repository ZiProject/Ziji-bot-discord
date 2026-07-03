const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "AiAutoplay",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, arg) => {
		try {
			const track = player?.queue?.currentTrack ?? player?.queue?.previousTracks?.[player?.queue?.previousTracks?.length - 1];
			const embed = new EmbedBuilder()
				.setDescription(arg || "No description available")
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
