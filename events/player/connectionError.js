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
	name: "connectionError",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {Error} error
	 */
	execute: async (player, error) => {
		// Log for diagnostics
		try {
			const client = this.client;
			client?.errorLog?.("**Player connectionError**");
			client?.errorLog?.(error?.message || String(error));
		} catch {}
		try {
			this.logger.error(error);
		} catch {}

		// Lightweight user feedback in the channel (auto-delete)
		try {
			const embed = new EmbedBuilder()
				.setDescription(`:warning: Connection error: ${error?.message || "Unknown error"}`)
				.setColor("Red")
				.setTimestamp();

			const replied = await player?.userdata?.channel?.send({ embeds: [embed], fetchReply: true }).catch(() => {});
			setTimeout(() => replied?.delete().catch(() => {}), 5000);
		} catch {}
	},
};
