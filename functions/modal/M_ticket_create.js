const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useHooks } = require("zihooks");
module.exports.data = {
	name: "M_ticket_create",
	type: "modal",
};

/**
 * @param { object } params - Parameters object
 * @param { import("discord.js").ButtonInteraction } params.interaction - interaction
 * @param { object } params.lang - language object
 */
module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply({ ephemeral: true });
	const reason = interaction.fields.getTextInputValue("reason") || "Không có lý do nào được cung cấp";
	const guild = interaction.guild;
	const member = interaction.member;
	const DataBase = useHooks.get("db");
	let GuildSetting = await DataBase.ZiGuild.findOne({ guildId: guild.id });
	if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId: guild.id });
	if (!GuildSetting.ticket) return interaction.editReply({ content: "❌ Ticket system chưa được thiết lập!" });
	const categoryId = GuildSetting.ticket.categoryId;
	// console.log(categoryId);
	const staffRoleId = GuildSetting.ticket.staffRoleId;
	const categoryChannel = guild.channels.cache.get(categoryId);
	if (!categoryChannel) return interaction.editReply({ content: "❌ Category ticket không tồn tại!" });
	const staffRole = staffRoleId ? guild.roles.cache.get(staffRoleId) : null;
	const ticketChannel = await guild.channels.create({
		name: `ticket-${member.user.username}`,
		type: 0,
		parent: categoryChannel,
		permissionOverwrites: [
			{
				id: guild.roles.everyone,
				deny: ["ViewChannel"],
			},
			{
				id: member.id,
				allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
			},
		],
	});
	if (staffRole) {
		await ticketChannel.permissionOverwrites.edit(staffRole, {
			ViewChannel: true,
			SendMessages: true,
			ReadMessageHistory: true,
		});
	}
	const ticketEmbed = {
		color: 0x57f287,
		title: "📌 Ticket đã được tạo thành công!",
		description: `Xin chào ${member}, đội ngũ ${staffRole ? `<@&${staffRole.id}>` : "Admin / Moderator"} đã nhận được yêu cầu của bạn.`,
		fields: [
			{
				name: "📝 Lý do hỗ trợ:",
				value: `\`\`\`${reason}\`\`\``, // Bọc trong block code cho đẹp và nổi bật
			},
		],
		footer: { text: `Người tạo: ${member.user.tag}` },
		timestamp: new Date(),
	};

	const closeRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_ticket_close").setLabel("🔒 Đóng Ticket").setStyle(ButtonStyle.Danger),
	);
	const roles = await guild.roles.fetch();
	const adminRoles = roles.filter((role) => role.permissions.has("Administrator") && !role.managed);
	const formattedMentions = adminRoles.map((role) => `<@&${role.id}>`).join(" ");
	await ticketChannel.send({
		content: `${member} ${staffRole ? `<@&${staffRole.id}>` : formattedMentions}`,
		embeds: [ticketEmbed],
		components: [closeRow],
	});

	// Phản hồi cho user ở kênh gốc biết channel đã tạo xong
	await interaction.editReply({ content: `✅ Đã tạo thành công kênh ticket của bạn tại: ${ticketChannel}` });
	const embedLog = {
		color: 0x5865f2,
		title: `🎫 Ticket Mới: ${member.user.tag}`,
		description: `**Người tạo:** <@${member.id}> (${member.user.tag})\n**Lý do:** \`${reason}\`\n**Kênh:** ${ticketChannel}`,
		timestamp: new Date(),
	};
	if (GuildSetting.ticket.logChannelId) {
		const logChannel = guild.channels.cache.get(GuildSetting.ticket.logChannelId);
		if (logChannel) {
			await logChannel.send({ embeds: [embedLog] });
		}
	}
};
