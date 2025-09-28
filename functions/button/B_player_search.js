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

// Player will be available through this.manager in bound context
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports.data = {
	name: "B_player_search",
	type: "button",
	category: "musix",
	ckeckVoice: true,
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @param {import("ziplayer").Player} button.player - player
 * @returns
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	await interaction.deferUpdate().catch(() => {});
	if (!player?.connection) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	const modal = new ModalBuilder()
		.setTitle("Search")
		.setCustomId("M_player_search")
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId("search-input").setLabel("Search for a song").setStyle(TextInputStyle.Short),
			),
		);
	await interaction.showModal(modal);
	return;
};
