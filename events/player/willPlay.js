const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "willPlay",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 * @param {import('ziplayer').Track[]} tracks
	 */
	execute: async (player, track, tracks) => {
		const isList = Array.isArray(tracks) && tracks.length > 1;
		const desc =
			isList ?
				`:arrow_forward: Will play ${tracks.length} tracks next. First: [${tracks[0]?.title}](${tracks[0]?.url})`
			:	`:arrow_forward: Will play: [${track?.title}](${track?.url})`;

		try {
			const embed = new EmbedBuilder()
				.setDescription(desc)
				.setThumbnail((track || tracks?.[0])?.thumbnail || null)
				.setColor("Random")
				.setTimestamp()
				.setFooter({
					text: `by: ${(track || tracks?.[0])?.requestedBy?.username ?? "Unknown"}`,
					iconURL: (track || tracks?.[0])?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
				});

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
