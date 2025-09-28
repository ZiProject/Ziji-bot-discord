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

const { MessageFlags, PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "B_Cfs_Reject",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	const member = await interaction.guild.members.fetch(interaction.user);
	if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.reply({
			content: lang.until.noPermission,
			flags: MessageFlags.Ephemeral,
		});
	}
	const database = this.db;
	if (!database)
		return interaction.reply({
			content: lang.until.noDB,
			flags: MessageFlags.Ephemeral,
		});
	const confession = await database.ZiConfess.findOne({ guildId: interaction.guildId });
	if (!confession || !confession.enabled || !confession.channelId) {
		return interaction.reply({
			content: "Confession đang không bật hoặc chưa được setup trong server của bạn!",
			flags: MessageFlags.Ephemeral,
		});
	}
	const currentConfession = confession.confessions.find((cfs) => cfs.reviewMessageId == interaction.message.id);
	if (!confession || currentConfession.status != "pending")
		return interaction.reply({
			content: "Confession đã được kiểm duyệt hoặc từ chối trước đó hoặc đã bị xóa",
			flags: MessageFlags.Ephemeral,
		});
	await database.ZiConfess.updateOne(
		{ guildId: interaction.guildId, "confessions.reviewMessageId": interaction.message.id },
		{
			$set: {
				"confessions.$.status": "rejected",
			},
		},
	);

	// Phản hồi lại người nhấn nút
	await interaction.reply({
		content: "✅ Confession đã được bỏ qua thành công!",
		flags: MessageFlags.Ephemeral,
	});
	await interaction.message.edit({
		content: `Từ chối bởi <@${interaction.user.id}>`,
		components: [],
	});
};
