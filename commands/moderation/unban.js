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

const { PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "unban",
	description: "Bỏ cấm một người dùng khỏi máy chủ",
	type: 1, // slash command
	options: [
		{
			name: "user_id",
			description: "ID của người dùng cần bỏ cấm",
			type: 3, // string
			required: true,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const userId = interaction.options.getString("user_id");

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	try {
		const user = await interaction.guild.bans.fetch(userId);

		if (!user) {
			return interaction.reply({
				content: "Người dùng không bị cấm hoặc ID không chính xác.",
				ephemeral: true,
			});
		}

		await interaction.guild.members.unban(userId);
		interaction.reply({ content: `Đã bỏ cấm người dùng với ID: ${userId}` });
	} catch (error) {
		console.error("Lỗi khi bỏ cấm người dùng:", error);
		interaction.reply({
			content: "Không thể bỏ cấm người dùng. Vui lòng đảm bảo ID chính xác và người dùng đang bị cấm.",
			ephemeral: true,
		});
	}
};
