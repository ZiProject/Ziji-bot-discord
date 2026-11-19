"use strict";

const { MessageFlags, PermissionsBitField, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "counting",
	description: "Trò chơi đếm số",
	type: 1,
	integration_types: [0],
	contexts: [0],
	options: [
		{
			name: "set-channel",
			description: "Thiết lập kênh chơi đếm số",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Kênh văn bản dùng để đếm số",
					type: 7,
					channel_types: [0],
					required: true,
				},
			],
		},
		{ name: "start", description: "Bắt đầu hoặc chơi lại từ số 1", type: 1 },
		{ name: "reset", description: "Đặt số đếm về 0 nhưng giữ nguyên kênh", type: 1 },
		{ name: "disable", description: "Tắt trò chơi đếm số", type: 1 },
	],
};

module.exports.execute = async ({ interaction }) => {
	const guildId = interaction.guildId;
	const db = useHooks.get("db");
	if (!guildId || !db?.ZiGuild) {
		return interaction.editReply({ content: "❌ Database hiện không khả dụng hoặc lệnh chỉ dùng trong server." });
	}

	if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.editReply({ content: "❌ Bạn cần quyền **Quản lý máy chủ** để sử dụng lệnh này." });
	}

	const subcommand = interaction.options.getSubcommand();
	let setting;
	try {
		setting = await db.ZiGuild.findOne({ guildId });
	} catch (error) {
		useHooks.get("logger")?.error?.("[counting] Failed to read guild settings", error);
		return interaction.editReply({ content: "❌ Không thể đọc cài đặt máy chủ. Vui lòng thử lại." });
	}

	const config = {
		enabled: setting?.counting?.enabled ?? false,
		channel: setting?.counting?.channel ?? null,
		count: setting?.counting?.count ?? 0,
		lastPlayer: setting?.counting?.lastPlayer ?? null,
		lastMessageId: setting?.counting?.lastMessageId ?? null,
	};

	if (subcommand === "set-channel") {
		const channel = interaction.options.getChannel("channel");
		if (!channel?.isTextBased?.() || !channel.guild) {
			return interaction.editReply({ content: "❌ Vui lòng chọn một kênh văn bản trong server." });
		}

		const me = interaction.guild.members.me;
		const permissions = me?.permissionsIn(channel);
		if (
			!permissions?.has([
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			])
		) {
			return interaction.editReply({ content: "❌ Tôi cần quyền xem kênh, gửi tin nhắn và đọc lịch sử tin nhắn." });
		}

		config.channel = channel.id;
		config.enabled = false;
		config.count = 0;
		config.lastPlayer = null;
		config.lastMessageId = null;
	} else if (subcommand === "start" || subcommand === "reset") {
		if (!config.channel) {
			return interaction.editReply({ content: "⚠️ Chưa thiết lập kênh. Hãy dùng `/counting set-channel` trước." });
		}
		config.enabled = true;
		config.count = 0;
		config.lastPlayer = null;
		config.lastMessageId = null;
	} else if (subcommand === "disable") {
		if (!config.channel && !config.enabled) {
			return interaction.editReply({ content: "⚠️ Trò chơi đếm số hiện chưa được thiết lập." });
		}
		config.enabled = false;
		config.count = 0;
		config.lastPlayer = null;
		config.lastMessageId = null;
	}

	try {
		if (!setting) setting = new db.ZiGuild({ guildId });
		setting.counting = config;
		if (typeof setting.markModified === "function") setting.markModified("counting");
		await setting.save();
		useHooks.get("temp")?.set(`counting_${guildId}`, config);
	} catch (error) {
		useHooks.get("logger")?.error?.("[counting] Failed to save settings", error);
		return interaction.editReply({ content: "❌ Không thể lưu cài đặt trò chơi." });
	}

	if (subcommand === "set-channel") {
		return interaction.editReply({
			content: `✅ Đã thiết lập kênh đếm số tại <#${config.channel}>. Dùng \`/counting start\` để bắt đầu.`,
		});
	}

	if (subcommand === "disable") {
		const channel = config.channel ? await interaction.guild.channels.fetch(config.channel).catch(() => null) : null;
		if (channel?.isTextBased()) {
			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle("🛑 Trò chơi đếm số đã kết thúc")
				.setDescription("Quản trị viên đã tắt trò chơi. Số đếm đã được đặt lại.")
				.setTimestamp();
			await channel.send({ embeds: [embed] }).catch(() => {});
		}
		return interaction.editReply({ content: "✅ Đã tắt trò chơi đếm số." });
	}

	const channel = await interaction.guild.channels.fetch(config.channel).catch(() => null);
	if (!channel?.isTextBased()) {
		return interaction.editReply({ content: "❌ Không tìm thấy kênh đếm số. Hãy thiết lập lại bằng `/counting set-channel`." });
	}

	const embed = new EmbedBuilder()
		.setColor(0x3498db)
		.setTitle("🔢 Đếm Số — Bắt Đầu!")
		.setDescription(
			[
				"**Luật chơi:**",
				"• Mọi người lần lượt gửi số tiếp theo, bắt đầu từ **1**.",
				"• Mỗi lượt chỉ được gửi đúng **một số nguyên dương**.",
				"• Không được đếm hai lượt liên tiếp.",
				"• Sai số hoặc sai lượt sẽ khiến bộ đếm trở về **0**.",
				"",
				"🎯 Cùng nhau đạt con số cao nhất nhé!",
			].join("\n"),
		)
		.setFooter({ text: "Phiên mới đã sẵn sàng • Số tiếp theo: 1" })
		.setTimestamp();

	await channel.send({ embeds: [embed] }).catch(() => {});
	return interaction.editReply({
		content: `${subcommand === "reset" ? "♻️ Đã đặt lại" : "✅ Đã bắt đầu"} trò chơi tại <#${config.channel}>. Số tiếp theo là **1**.`,
	});
};
