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

const DefaultPlayerConfig = {
	selfDeaf: false,
	volume: 100,
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: 50_000,
	leaveOnEnd: true,
	leaveOnEndCooldown: 500_000,
	pauseOnEmpty: true,
};

//====================================================================//
/**
 * @param { import ("discord.js").BaseInteraction } interaction
 * @param { String } context
 * @param { langdef } lang
 */
module.exports.execute = async (interaction, context, lang, options = { assistant: true }) => {
	try {
		const query = `tts:${lang?.name ?? "vi"}: ${context}`;
		this.functions?.get("Search").execute(interaction, query, lang, options);
		return;
	} catch (e) {
		console.error(e);
		return;
	}
};

//====================================================================//
module.exports.data = {
	name: "TextToSpeech",
	type: "player",
};
