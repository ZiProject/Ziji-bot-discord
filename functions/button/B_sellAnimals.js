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

module.exports.data = {
	name: "B_sellAnimals",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	const embed = new EmbedBuilder()
		.setTitle("💰 Sell Animals")
		.setColor("#4CAF50")
		.setDescription(
			"🎯 **Sử dụng lệnh `/sell` để bán animals!**\n\n💡 **Features:**\n🦁 Bán theo từng loại rarity\n💰 Tính giá tự động\n✨ Nhận XP bonus\n🎯 Menu interactive dễ sử dụng\n\n**Lệnh:** `/sell` hoặc `/sell [rarity] [amount]`",
		)
		.setFooter({ text: "ZiBot • Sell System Ready!", iconURL: interaction.client.user.displayAvatarURL() })
		.setTimestamp();

	return await interaction.reply({ embeds: [embed], ephemeral: true });
};
