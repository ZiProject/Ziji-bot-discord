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
	name: "trackStart",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 */
	execute: async (player, track) => {
		const player_func = this.functions?.get("player_func");
		if (!player_func) return;

		const playerGui = await player_func.execute({ player, tracks: track });

		try {
			await player.userdata.mess.edit(playerGui);
		} catch {
			player.userdata.mess = await player.userdata.channel.send(playerGui);
		}

		// Status of voice channel
		if (this.config.PlayerConfig?.changeStatus) {
			const status = `💿 Now playing: ${track.title}`;
			const { rest } = this.client;
			rest.put(`/channels/${player?.connection?.joinConfig.channelId}/voice-status`, { body: { status } }).catch((e) => {
				console.log(e);
			});
		}
	},
};
