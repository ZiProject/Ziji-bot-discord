"use strict";

/**
 * wordGame.js — MessageCreate handler for the Vietnamese word-chain (nối từ) game.
 *
 * Flow:
 *  1. Ignore bots, DMs, and messages outside the designated noitu channel.
 *  2. Ignore messages that start with a bot command prefix.
 *  3. Validate the submitted word against game rules (syllable count, dictionary,
 *     chain continuity, duplicate check, same-player repeat).
 *  4. On failure → react ❌ + reply with the reason.
 *  5. On success → react ✅ + reply with the next required starting syllable.
 *     Update the persistent game state in wordgame.json.
 */

const { Events } = require("discord.js");
const { useHooks } = require("zihooks");
const {
	loadDictionary,
	countSyllables,
	getFirstSyllable,
	getLastSyllable,
	isValidWord,
	loadGameState,
	saveGameState,
} = require("../../utility/wordGameUtils");

// Pre-warm the dictionary on file load so the first message has no delay.
loadDictionary();

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

// ─── Config cache ──────────────────────────────────────────────────────────
// We cache { enabled, channel } per guild in the shared "temp" Collection so
// that subsequent messages don't require a database round-trip.
// The noitu.js slash command invalidates this cache whenever settings change
// by calling:   useHooks.get('temp')?.set(`noitu_${guildId}`, newConfig)

/**
 * Retrieve the noitu configuration for a guild.
 * Reads from the in-memory cache first; falls back to the database.
 *
 * @param {string} guildId
 * @param {object} db — the database hook (useHooks.get('db'))
 * @returns {Promise<{ enabled: boolean, channel: string|null }>}
 */
async function getNoituConfig(guildId, db) {
	const cached = useHooks.get("temp")?.get(`noitu_${guildId}`);
	if (cached !== undefined) return cached;

	const setting = await db.ZiGuild.findOne({ guildId });
	const config = {
		enabled: setting?.noitu?.enabled ?? false,
		channel: setting?.noitu?.channel ?? null,
	};

	useHooks.get("temp")?.set(`noitu_${guildId}`, config);
	return config;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Reply to a message and react with ❌.
 * Both operations are best-effort (channel might lack permissions).
 */
async function reject(message, reason) {
	// Lưu lại hứa hẹn gửi icon react
	const reactPromise = message.react("❌").catch(() => {});
	const replyPromise = message
		.reply({
			content: reason,
			allowedMentions: { repliedUser: false },
		})
		.then((repliedMessage) => {
			setTimeout(() => {
				repliedMessage.delete().catch(() => {});
			}, 5000);
		})
		.catch(() => {});

	await Promise.all([reactPromise, replyPromise]);
}

// ─── Event handler ─────────────────────────────────────────────────────────

module.exports.execute = async (message) => {
	if (!message.client.isReady()) return;
	if (message.author.bot) return;
	if (!message.guild) return;

	const db = useHooks.get("db");
	if (!db) return;

	const guildId = message.guild.id;

	// ── Gate: check if noitu is active and this is the designated channel ──
	let config;
	try {
		config = await getNoituConfig(guildId, db);
	} catch {
		return; // DB unavailable — fail silently
	}

	if (!config.enabled || !config.channel || message.channel.id !== config.channel) return;

	// ── Gate: ignore command messages ──────────────────────────────────────
	const configData = useHooks.get("config");
	const prefix = configData?.prefix ?? "z!";
	const raw = message.content.trim();
	if (!raw || raw.startsWith("/") || raw.startsWith(prefix)) return;

	// ══ Rule 1: exactly 2 syllables ═══════════════════════════════════════
	if (countSyllables(raw) !== 2) {
		return reject(message, "❌ Từ phải có đúng **2 âm tiết** (ví dụ: `hành lá`).");
	}

	const word = raw.toLowerCase();
	const state = loadGameState(guildId);

	// ══ Rule 2: must not be the same player as the previous turn ══════════
	if (state.lastPlayer && state.lastPlayer === message.author.id) {
		return reject(message, "❌ Bạn vừa đi rồi! Hãy để người khác nối tiếp.");
	}

	// ══ Rule 3: first syllable must chain from the previous last syllable ═
	if (state.lastSyllable) {
		const firstSyl = getFirstSyllable(word);
		if (firstSyl !== state.lastSyllable) {
			return reject(message, `❌ Từ phải bắt đầu bằng **"${state.lastSyllable}"** (bạn gõ: "${firstSyl}").`);
		}
	}

	// ══ Rule 4: word must exist in the dictionary ══════════════════════════
	if (!isValidWord(word)) {
		return reject(message, `❌ **"${raw}"** không có trong từ điển!`);
	}

	// ══ Rule 5: word must not have been used this session ═════════════════
	if (state.usedWords.includes(word)) {
		return reject(message, `❌ **"${raw}"** đã được sử dụng trong phiên này rồi!`);
	}

	// ══ All rules passed ═══════════════════════════════════════════════════
	const nextSyllable = getLastSyllable(word);

	// Persist state
	state.lastWord = word;
	state.lastSyllable = nextSyllable;
	state.lastPlayer = message.author.id;
	state.usedWords.push(word);
	saveGameState(guildId, state);

	// React and inform of next required syllable
	await message.react("✅").catch(() => {});
};
