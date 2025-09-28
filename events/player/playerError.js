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

module.exports = {
	name: "playerError",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {Error} error
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, error, track) => {
		const client = this.client;
		client.errorLog("**Player playerError**");
		client?.errorLog(error.message);
		client?.errorLog(track.url);
		this.logger.error(error);
	},
};
