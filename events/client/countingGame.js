"use strict";

const { Events } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

// Serialize messages per guild so two near-simultaneous posts cannot both
// advance the same counter from the same previous value.
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
	const config = {
		enabled: guild?.counting?.enabled ?? false,
		channel: guild?.counting?.channel ?? null,
		count: Number.isSafeInteger(guild?.counting?.count) ? guild.counting.count : 0,
		lastPlayer: guild?.counting?.lastPlayer ?? null,
		lastMessageId: guild?.counting?.lastMessageId ?? null,
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

async function failTurn(message, config, db, guildId, reason) {
	config.count = 0;
	config.lastPlayer = null;
	config.lastMessageId = null;
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

	const configData = useHooks.get("config");
	const prefix = configData?.prefix ?? "z!";
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
		try {
			await persistConfig(db, guildId, config);
		} catch (error) {
			useHooks.get("logger")?.error?.("[counting] Failed to save count", error);
			return;
		}

		await message.react("✅").catch(() => {});
	});
};
