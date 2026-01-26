const { useHooks } = require("zihooks");
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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const member = await interaction.guild.members.fetch(interaction.user);
	if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.reply({
			content: lang.until.noPermission,
			flags: MessageFlags.Ephemeral,
		});
	}
	const database = useHooks.get("db");
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
