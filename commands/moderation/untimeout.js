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
	name: "untimeout",
	description: "Bỏ cấm tạm thời một người dùng",
	type: 1, // slash command
	options: [
		{
			name: "user",
			description: "Người dùng cần bỏ cấm tạm thời",
			type: 6, // user
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
	const user = interaction.options.getUser("user");

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	const member = interaction.guild.members.cache.get(user.id);
	if (!member) {
		return interaction.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
	}

	try {
		await member.timeout(null);
		interaction.reply({ content: `Đã bỏ cấm tạm thời ${user.tag}` });
	} catch (error) {
		console.error("Lỗi khi bỏ cấm tạm thời:", error);
		interaction.reply({ content: "Không thể bỏ cấm tạm thời người dùng.", ephemeral: true });
	}
};
