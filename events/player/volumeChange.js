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
