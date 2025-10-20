const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "queueAddList",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track[]} tracks
	 */
	execute: async (player, tracks) => {
		const embed = new EmbedBuilder()
			.setDescription(
				`Đã thêm danh sách phát: [${tracks[0]?.metadata?.playlist?.title || "Không có tiêu đề"}](${tracks[0]?.metadata?.playlist?.url || `https://soundcloud.com`})`,
			)
			.setThumbnail(tracks?.[0]?.thumbnail)
			.setColor("Random")
			.setTimestamp()
			.setFooter({
				text: `by: ${tracks?.[0]?.requestedBy?.username}`,
				iconURL: tracks?.[0]?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
			});
		const replied = await player.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch((e) => {});
		setTimeout(function () {
			replied?.delete().catch((e) => {});
		}, 5000);
	},
};
