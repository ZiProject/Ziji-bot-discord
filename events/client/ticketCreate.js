const {
	Events,
	PermissionsBitField,
	ChannelType,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { useHooks } = require("zihooks");

/**
 * Ticket Button Handler
 * create / close / confirm
 */
module.exports = {
	name: Events.InteractionCreate,
	type: "events",
	enable: true,

	/**
	 * @param { import("discord.js").Interaction } interaction
	 */
	execute: async (interaction) => {
		if (!interaction.isButton()) return;

		const id = interaction.customId;

		if (id === "ticket:create") return handleCreate(interaction);
		if (id === "ticket:close") return handleAskClose(interaction);
		if (id === "ticket:close:yes") return handleConfirmClose(interaction);
		if (id === "ticket:close:no") return handleCancelClose(interaction);
	},
};

/* ===================== CREATE ===================== */

async function handleCreate(interaction) {
	const logger = useHooks.get("logger");
	const guild = interaction.guild;
	const user = interaction.user;

	const existed = guild.channels.cache.find((c) => c.name === `ticket-${user.id}`);
	if (existed)
		return interaction.reply({
			content: "⚠️ Bạn đã có ticket rồi.",
			ephemeral: true,
		});

	const channel = await guild.channels.create({
		name: `ticket-${user.id}`,
		type: ChannelType.GuildText,
		permissionOverwrites: [
			{
				id: guild.id,
				deny: [PermissionsBitField.Flags.ViewChannel],
			},
			{
				id: user.id,
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ReadMessageHistory,
				],
			},
		],
	});

	await interaction.reply({
		content: `✅ Ticket đã tạo: ${channel}`,
		ephemeral: true,
	});

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("ticket:close").setLabel("Đóng Ticket").setStyle(ButtonStyle.Danger),
	);

	const embed = new EmbedBuilder()
		.setTitle("🎫 Ticket Support")
		.setDescription(`Xin chào ${user}\nHãy mô tả vấn đề của bạn.\n\n🔒 Khi xong, nhấn **Đóng Ticket**.`)
		.setColor("Green");

	await channel.send({ embeds: [embed], components: [row] });
	logger.info(`[TICKET] Created ticket for ${user.tag}`);
}

/* ===================== ASK CONFIRM ===================== */

async function handleAskClose(interaction) {
	const channel = interaction.channel;
	const member = interaction.member;

	if (!channel.name.startsWith("ticket-"))
		return interaction.reply({
			content: "❌ Nút này chỉ dùng trong ticket.",
			ephemeral: true,
		});

	const ownerId = channel.name.replace("ticket-", "");
	const isOwner = interaction.user.id === ownerId;
	const isStaff = member.permissions.has(PermissionsBitField.Flags.ManageChannels);

	if (!isOwner && !isStaff)
		return interaction.reply({
			content: "⛔ Bạn không có quyền đóng ticket này.",
			ephemeral: true,
		});

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("ticket:close:yes").setLabel("Xác nhận đóng").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId("ticket:close:no").setLabel("Huỷ").setStyle(ButtonStyle.Secondary),
	);

	return interaction.reply({
		content: "⚠️ Bạn có chắc muốn **đóng ticket** không?",
		components: [row],
		ephemeral: true,
	});
}

/* ===================== CONFIRM CLOSE ===================== */

async function handleConfirmClose(interaction) {
	const logger = useHooks.get("logger");
	const config = useHooks.get("config");
	const channel = interaction.channel;

	await interaction.reply({
		content: "🧾 Đang lưu transcript và đóng ticket...",
		ephemeral: true,
	});

	/* ===== Collect transcript ===== */
	const messages = await channel.messages.fetch({ limit: 100 });
	const content = messages
		.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
		.map((m) => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`)
		.join("\n");

	/* ===== Send log ===== */
	const logChannelId = config?.ticket?.logChannelId;
	const logChannel = channel.guild.channels.cache.get(logChannelId);

	if (logChannel) {
		const embed = new EmbedBuilder()
			.setTitle("🧾 Ticket Closed")
			.addFields(
				{ name: "Channel", value: channel.name, inline: true },
				{ name: "Closed by", value: interaction.user.tag, inline: true },
			)
			.setColor("Red")
			.setTimestamp();

		await logChannel.send({
			embeds: [embed],
			files: [
				{
					attachment: Buffer.from(content || "No messages"),
					name: `${channel.name}.txt`,
				},
			],
		});
	}

	setTimeout(async () => {
		try {
			await channel.delete("Ticket closed");
			logger.info(`[TICKET] Closed ${channel.name}`);
		} catch (err) {
			logger.error("[TICKET] Close error:", err);
		}
	}, 3000);
}

/* ===================== CANCEL ===================== */

async function handleCancelClose(interaction) {
	return interaction.update({
		content: "❎ Đã huỷ đóng ticket.",
		components: [],
	});
}
