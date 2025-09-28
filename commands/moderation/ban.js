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
	name: "ban",
	description: "Cấm một người dùng khỏi máy chủ",
	type: 1, // slash command
	options: [
		{
			name: "user",
			description: "Người dùng cần cấm",
			type: 6, // user
			required: true,
		},
		{
			name: "reason",
			description: "Lý do cấm",
			type: 3, // string
			required: false,
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
	const reason = interaction.options.getString("reason") || "Không có lý do";

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers) && user.id !== interaction.client.user.id) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	if (user.id === interaction.user.id) {
		return interaction.reply({ content: "Bạn không thể tự cấm chính mình.", ephemeral: true });
	}

	const member = interaction.guild.members.cache.get(user.id);
	if (!member) {
		return interaction.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
	}

	if (member.roles.highest.position >= interaction.member.roles.highest.position) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	try {
		await user.send(`Bạn đã bị cấm khỏi ${interaction.guild.name} vì: ${reason}`);
	} catch (error) {
		console.error(`Không thể gửi tin nhắn trực tiếp cho ${user.tag}:`, error);
	}

	await member.ban({ reason });
	interaction.reply({ content: `Đã cấm ${user.tag} vì: ${reason}` });
};
