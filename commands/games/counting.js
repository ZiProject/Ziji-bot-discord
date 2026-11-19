"use strict";

const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { createImageStudioAttachment } = require("../../utility/imageStudio");

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
		{ name: "leaderboard", description: "Xem bảng xếp hạng Counting Game toàn hệ thống", type: 1 },
	],
};

function getGuildIcon(guild, client) {
	return (
		guild?.iconURL?.({ size: 1024, extension: "png" }) ||
		client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" })
	);
}

async function buildGuildRanking(client, db) {
	const settings = await db.ZiGuild.find({});
	const entries = [];

	for (const setting of settings) {
		const stats = setting.counting?.stats;
		if (!stats || (!stats.record && !stats.totalCounts)) continue;

		const guild = client.guilds.cache.get(setting.guildId) || (await client.guilds.fetch(setting.guildId).catch(() => null));
		if (!guild) continue;

		entries.push({
			guild,
			record: Number(stats.record) || 0,
			totalCounts: Number(stats.totalCounts) || 0,
		});
	}

	entries.sort((a, b) => b.record - a.record || b.totalCounts - a.totalCounts || a.guild.name.localeCompare(b.guild.name));
	return entries;
}

function toLeaderboardItem(entry, rank) {
	return {
		rank,
		username: entry.guild.name,
		handle: `@${entry.guild.memberCount ?? 0} members • ${entry.record} record`,
		avatar: getGuildIcon(entry.guild, entry.guild.client),
		level: entry.record,
		xp: entry.totalCounts,
	};
}

module.exports.execute = async ({ interaction }) => {
	const db = useHooks.get("db");
	if (!db?.ZiGuild) {
		return interaction.editReply({ content: "❌ Database hiện không khả dụng." });
	}

	const subcommand = interaction.options.getSubcommand();

	// The global leaderboard is public and can be requested from any server.
	if (subcommand === "leaderboard") {
		try {
			const ranking = await buildGuildRanking(interaction.client, db);
			if (!ranking.length) {
				return interaction.editReply({ content: "📊 Chưa có guild nào ghi nhận thành tích Counting Game." });
			}

			const items = ranking.slice(0, 17).map((entry, index) => toLeaderboardItem(entry, index + 1));
			const attachment = await createImageStudioAttachment(
				{
					type: "leaderboard",
					data: {
						guildName: "Counting Game • Global Guild Ranking",
						guildIcon: getGuildIcon(interaction.guild, interaction.client),
						season: "GLOBAL GUILD RANKING",
						layout: "tier-division",
						items,
					},
				},
				"counting-leaderboard.png",
			);
			return interaction.editReply({ content: "", files: [attachment] });
		} catch (error) {
			useHooks.get("logger")?.error?.("[counting] Failed to build global leaderboard", error);
			return interaction.editReply({ content: "❌ Không thể tạo bảng xếp hạng lúc này. Vui lòng thử lại sau." });
		}
	}

	const guildId = interaction.guildId;
	if (!guildId || !interaction.guild) {
		return interaction.editReply({ content: "❌ Các thiết lập trò chơi chỉ dùng trong server." });
	}
	if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
		return interaction.editReply({ content: "❌ Bạn cần quyền **Quản lý máy chủ** để sử dụng lệnh này." });
	}

	let setting;
	try {
		setting = await db.ZiGuild.findOne({ guildId });
	} catch (error) {
		useHooks.get("logger")?.error?.("[counting] Failed to read guild settings", error);
		return interaction.editReply({ content: "❌ Không thể đọc cài đặt máy chủ. Vui lòng thử lại." });
	}

	const previous = setting?.counting ?? {};
	const config = {
		enabled: previous.enabled ?? false,
		channel: previous.channel ?? null,
		count: Number.isSafeInteger(previous.count) ? previous.count : 0,
		lastPlayer: previous.lastPlayer ?? null,
		lastMessageId: previous.lastMessageId ?? null,
		milestoneSent: Number(previous.milestoneSent) || 0,
		stats: {
			record: Number(previous.stats?.record) || 0,
			totalCounts: Number(previous.stats?.totalCounts) || 0,
			completedRuns: Number(previous.stats?.completedRuns) || 0,
		},
	};

	if (subcommand === "set-channel") {
		const channel = interaction.options.getChannel("channel");
		if (!channel?.isTextBased?.() || !channel.guild) {
			return interaction.editReply({ content: "❌ Vui lòng chọn một kênh văn bản trong server." });
		}

		const permissions = interaction.guild.members.me?.permissionsIn(channel);
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
		config.milestoneSent = 0;
	} else if (subcommand === "start" || subcommand === "reset") {
		if (!config.channel) {
			return interaction.editReply({ content: "⚠️ Chưa thiết lập kênh. Hãy dùng `/counting set-channel` trước." });
		}
		if (config.count > 0) config.stats.completedRuns++;
		config.enabled = true;
		config.count = 0;
		config.lastPlayer = null;
		config.lastMessageId = null;
		config.milestoneSent = 0;
	} else if (subcommand === "disable") {
		if (!config.channel && !config.enabled) {
			return interaction.editReply({ content: "⚠️ Trò chơi đếm số hiện chưa được thiết lập." });
		}
		if (config.count > 0) config.stats.completedRuns++;
		config.enabled = false;
		config.count = 0;
		config.lastPlayer = null;
		config.lastMessageId = null;
		config.milestoneSent = 0;
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
		const channel = await interaction.guild.channels.fetch(config.channel).catch(() => null);
		if (channel?.isTextBased()) {
			const embed = new EmbedBuilder()
				.setColor(0xe74c3c)
				.setTitle("🛑 Trò chơi đếm số đã kết thúc")
				.setDescription("Quản trị viên đã tắt trò chơi. Thành tích tích lũy vẫn được giữ lại.")
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
				"🏆 Thành tích guild được lưu xuyên suốt các phiên chơi.",
				"📸 Bot gửi ảnh thành tích sau mỗi 10 số.",
			].join("\n"),
		)
		.setFooter({ text: "Phiên mới đã sẵn sàng • Số tiếp theo: 1" })
		.setTimestamp();

	await channel.send({ embeds: [embed] }).catch(() => {});
	return interaction.editReply({
		content: `${subcommand === "reset" ? "♻️ Đã đặt lại" : "✅ Đã bắt đầu"} trò chơi tại <#${config.channel}>. Số tiếp theo là **1**.`,
	});
};
