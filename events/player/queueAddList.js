/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

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
				`Đã thêm danh sách phát: [${tracks[0]?.playlist?.title || "Không có tiêu đề"}](${tracks[0]?.playlist?.url || `https://soundcloud.com`})`,
			)
			.setThumbnail(tracks?.thumbnail)
			.setColor("Random")
			.setTimestamp()
			.setFooter({
				text: `by: ${tracks?.requestedBy?.username}`,
				iconURL: tracks?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
			});
		const replied = await player.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch((e) => {});
		setTimeout(function () {
			replied?.delete().catch((e) => {});
		}, 5000);
	},
};
