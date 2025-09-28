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

const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "player",
	description: "Gọi Player",
	category: "musix",
	type: 1, // slash commad
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang
 * @param {import("ziplayer").Player} command.player - player
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	await interaction.deferReply({ withResponse: true });
	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying }).catch((e) => {});
	player?.userdata?.mess?.edit({ components: [] }).catch((e) => {});

	player.userdata.mess = await interaction.fetchReply();

	const player_func = this.functions?.get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	await interaction.editReply(res);
};
