const { useHooks } = require("zihooks");
const { EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");

module.exports.data = {
	name: "B_Cfs_Accept",
	type: "button",
};

/**
 * @param { object } button
 * @param { import("discord.js").ButtonInteraction } button.interaction
 * @param { import("../../lang/vi.js") } button.lang
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
	const member = await interaction.guild.members.fetch(interaction.user.id);
	if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.reply({
			content: lang.until.noPermission,
			flags: MessageFlags.Ephemeral,
		});
	}

	const database = useHooks.get("db");
	if (!database) {
		return interaction.reply({
			content: lang.until.noDB,
			flags: MessageFlags.Ephemeral,
		});
	}

	const confessionData = await database.ZiConfess.findOne({ guildId: interaction.guildId });
	if (!confessionData || !confessionData.enabled || !confessionData.channelId) {
		return interaction.reply({
			content: "Confession đang không bật hoặc chưa được setup trong server của bạn!",
			flags: MessageFlags.Ephemeral,
		});
	}

	const currentConfession = confessionData.confessions.find((cfs) => cfs.reviewMessageId === interaction.message.id);

	if (!currentConfession || currentConfession.status !== "pending") {
		return interaction.reply({
			content: "Confession đã được kiểm duyệt hoặc từ chối trước đó hoặc đã bị xóa",
			flags: MessageFlags.Ephemeral,
		});
	}

	// Gửi confession vào channel chính
	const cfsChannel = await interaction.guild.channels.fetch(confessionData.channelId);
	if (!cfsChannel) {
		return interaction.reply({
			content: "Không thể tìm thấy kênh để gửi confession!",
			flags: MessageFlags.Ephemeral,
		});
	}

	const embed = new EmbedBuilder()
		.setTitle(`Confession #${confessionData.currentId}`)
		.setDescription(currentConfession.content || "Không có nội dung")
		.setColor("Random")
		.setFooter({
			text: currentConfession.type === "public" ? `Được gửi bởi ${currentConfession.author?.username || "Không rõ"}` : "Ẩn danh",
		})
		.setTimestamp();

	if (currentConfession.type === "public" && currentConfession.author?.avatarURL) {
		embed.setThumbnail(currentConfession.author.avatarURL);
	}

	const sentMessage = await cfsChannel.send({ embeds: [embed] });
	const thread = await sentMessage.startThread({
		name: `Thảo luận Confession #${confession.currentId}`,
		autoArchiveDuration: 10080,
	});
	// Cập nhật lại DB
	await database.ZiConfess.updateOne(
		{ guildId: interaction.guildId, "confessions.reviewMessageId": interaction.message.id },
		{
			$set: {
				"confessions.$.status": "approved",
				"confessions.$.messageId": sentMessage.id,
				"confessions.$.threadId": thread.id,
			},
		},
	);

	// Phản hồi admin
	await interaction.reply({
		content: "✅ Confession đã được chấp nhận và đăng thành công!",
		flags: MessageFlags.Ephemeral,
	});

	// Gỡ nút
	await interaction.message.edit({
		content: `✅ Confession đã được chấp nhận bởi <@${interaction.user.id}>`,
		components: [],
	});
};
