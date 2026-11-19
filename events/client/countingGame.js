"use strict";

const { Events } = require("discord.js");
const { useHooks } = require("zihooks");
const { createImageStudioAttachment } = require("../../utility/imageStudio");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

const guildQueues = new Map();

async function withGuildLock(guildId, task) {
	const previous = guildQueues.get(guildId) || Promise.resolve();
	const current = previous.catch(() => {}).then(task);
	guildQueues.set(guildId, current);
	try {
		return await current;
	} finally {
		if (guildQueues.get(guildId) === current) guildQueues.delete(guildId);
	}
}

async function getConfig(guildId, db) {
	const temp = useHooks.get("temp");
	const cached = temp?.get(`counting_${guildId}`);
	if (cached !== undefined) return cached;

	const guild = await db.ZiGuild.findOne({ guildId });
	const saved = guild?.counting ?? {};
	const config = {
		enabled: saved.enabled ?? false,
		channel: saved.channel ?? null,
		count: Number.isSafeInteger(saved.count) ? saved.count : 0,
		lastPlayer: saved.lastPlayer ?? null,
		lastMessageId: saved.lastMessageId ?? null,
		milestoneSent: Number(saved.milestoneSent) || 0,
		stats: {
			record: Number(saved.stats?.record) || 0,
			totalCounts: Number(saved.stats?.totalCounts) || 0,
			completedRuns: Number(saved.stats?.completedRuns) || 0,
		},
	};
	temp?.set(`counting_${guildId}`, config);
	return config;
}

async function persistConfig(db, guildId, config) {
	const guild = await db.ZiGuild.findOne({ guildId });
	if (!guild) return false;
	guild.counting = config;
	if (typeof guild.markModified === "function") guild.markModified("counting");
	await guild.save();
	useHooks.get("temp")?.set(`counting_${guildId}`, config);
	return true;
}

async function sendMilestoneImage(message, config, milestone) {
	try {
		const attachment = await createImageStudioAttachment(
			{
				type: "leaderboard",
				data: {
					guildName: message.guild.name,
					guildIcon:
						message.guild.iconURL({ size: 1024, extension: "png" }) ||
						message.client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
					season: `COUNTING MILESTONE • #${milestone}`,
					layout: "tier-division",
					items: [
						{
							rank: 1,
							username: message.guild.name,
							handle: `@${message.guild.memberCount} members • ${config.stats.record} record`,
							avatar:
								message.guild.iconURL({ size: 1024, extension: "png" }) ||
								message.client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
							level: config.stats.record,
							xp: config.stats.totalCounts,
						},
					],
				},
			},
			`counting-milestone-${milestone}.png`,
		);
		await message.channel.send({
			content: `🏆 **${message.guild.name}** vừa đạt mốc **${milestone}**! Thành tích cao nhất: **${config.stats.record}** • Tổng lượt đếm: **${config.stats.totalCounts}**.`,
			files: [attachment],
		});
	} catch (error) {
		useHooks.get("logger")?.error?.("[counting] Failed to render milestone image", error);
		await message.channel
			.send(`🏆 **${message.guild.name}** vừa đạt mốc **${milestone}**! (Không thể tạo ảnh thành tích lần này.)`)
			.catch(() => {});
	}
}

async function failTurn(message, config, db, guildId, reason) {
	if (config.count > 0) config.stats.completedRuns++;
	config.count = 0;
	config.lastPlayer = null;
	config.lastMessageId = null;
	config.milestoneSent = 0;
	try {
		await persistConfig(db, guildId, config);
	} catch (error) {
		useHooks.get("logger")?.error?.("[counting] Failed to reset counter", error);
	}
	await message.react("❌").catch(() => {});
	const notice = await message
		.reply({
			content: `💥 ${reason}\nBộ đếm đã trở về **0**. Người chơi tiếp theo hãy gửi **1** nhé!`,
			allowedMentions: { repliedUser: false },
		})
		.catch(() => null);
	if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);
}

module.exports.execute = async (message) => {
	if (!message.client.isReady() || message.author.bot || !message.guild) return;

	const db = useHooks.get("db");
	if (!db?.ZiGuild) return;

	const prefix = useHooks.get("config")?.prefix ?? "z!";
	const raw = message.content.trim();
	if (!raw || raw.startsWith("/") || raw.startsWith(prefix)) return;

	await withGuildLock(message.guild.id, async () => {
		const guildId = message.guild.id;
		let config;
		try {
			config = await getConfig(guildId, db);
		} catch (error) {
			useHooks.get("logger")?.error?.("[counting] Failed to load config", error);
			return;
		}

		if (!config.enabled || !config.channel || message.channel.id !== config.channel) return;

		const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
		const expected = config.count + 1;

		if (!Number.isSafeInteger(value) || value < 1) {
			return failTurn(message, config, db, guildId, "Tin nhắn phải là một số nguyên dương.");
		}
		if (config.lastPlayer === message.author.id) {
			return failTurn(message, config, db, guildId, "Bạn vừa đếm lượt trước, hãy để người khác tiếp tục.");
		}
		if (value !== expected) {
			return failTurn(message, config, db, guildId, `Số đúng phải là **${expected}**, nhưng bạn đã gửi **${value}**.`);
		}

		config.count = value;
		config.lastPlayer = message.author.id;
		config.lastMessageId = message.id;
		config.stats.totalCounts++;
		config.stats.record = Math.max(config.stats.record, value);
		const milestone = value % 10 === 0 && config.milestoneSent < value ? value : null;
		if (milestone) config.milestoneSent = milestone;

		try {
			await persistConfig(db, guildId, config);
		} catch (error) {
			useHooks.get("logger")?.error?.("[counting] Failed to save count", error);
			return;
		}

		await message.react("✅").catch(() => {});
		if (milestone) await sendMilestoneImage(message, config, milestone);
	});
};
