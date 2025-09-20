const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "queueRemove",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 * @param {number} index
	 */
	execute: async (player, track, index) => {
		const embed = new EmbedBuilder()
			.setDescription(`:wastebasket: | Đã xóa ${index}. **${track?.title}**!`)
			.setThumbnail(track?.thumbnail)
			.setColor("Random")
			.setTimestamp()
			.setFooter({
				text: `by: ${track?.requestedBy?.username}`,
				iconURL: track?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
			});
		const replied = await player.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch((e) => {});
		setTimeout(function () {
			replied?.delete().catch((e) => {});
		}, 5000);
	},
};
