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
	name: "variable",
	description: "View the bot's variable",
	type: 1, // slash command
	options: [],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply({ ephemeral: false, fetchReply: true });
	const variable = new EmbedBuilder()
		.setColor(lang?.color || "Random")
		.setAuthor({ name: `Biến Và Chức Năng`, iconURL: interaction.client.user.displayAvatarURL({}) })
		.setDescription(
			`\n\n` +
				`**__Chức Năng Người Dùng (User)__**\n` +
				`\`{user}\`: e.g <@${interaction.client.user.id}>, Hiển thị người dùng\n` +
				`\`{user_id}\`: e.g ${interaction.client.user.id}, ID của người dùng\n` +
				`\`{user_tag}\`: e.g ${interaction.client.user.tag}, Tag của người dùng\n` +
				`\`{user_name}\`: e.g ${interaction.client.user.username}, Tên người dùng\n` +
				`\`{user_avatar}\`: e.g [Link avatar](<${interaction.client.user.displayAvatarURL()}>), URL avatar của người dùng\n` +
				`**__Chức Năng Máy Chủ (Server)__**\n` +
				`\`{server_name}\`: e.g ${interaction.guild.name}, Tên máy chủ\n` +
				`\`{server_id}\`: e.g ${interaction.guild.id}, ID của máy chủ\n` +
				`\`{server_membercount}\`: e.g ${interaction.guild.memberCount.toLocaleString()}, Số lượng thành viên trong máy chủ\n` +
				`\`{server_membercount_nobots}\`: e.g ${interaction.guild.members.cache.filter((member) => !member.user.bot).size.toLocaleString()} Số lượng thành viên bỏ qua bot\n`,
		)
		.setFooter({
			text: `${lang.until.requestBy} ${interaction.user?.username}`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();
	await interaction.editReply({ embeds: [variable] });
};
