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
	name: "client_info_button",
	description: "Button để hiển thị thông tin client",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 */

module.exports.execute = async function ({ interaction, lang }) {
	// Sử dụng this.client thay vì interaction.client
	const client = this.client;

	const embed = new EmbedBuilder()
		.setTitle("Thông tin Client từ Button")
		.setDescription(
			`**Bot Name:** ${client.user.username}\n**Bot ID:** ${client.user.id}\n**Guilds:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}`,
		)
		.setColor(0x0099ff)
		.setTimestamp();

	await interaction.reply({ embeds: [embed], ephemeral: true });
};
