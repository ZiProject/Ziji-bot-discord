"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const WORDS_PATH = path.resolve(__dirname, "../data/dictionary.br");
const ACCEPTED_PATH = path.resolve(__dirname, "../data/accepted-words.txt");
const GAME_STATE_PATH = path.resolve(__dirname, "../jsons/wordgame.json");

// ─── Dictionary cache ──────────────────────────────────────────────────────

/** @type {Set<string>|null} Lazy-loaded, shared across the process. */
let dictionary = null;

/**
 * Load and cache the Vietnamese word dictionary.
 *
 * Sources:
 *  • `data/words.txt`        — JSONL, each line: { "text": "...", ... }
 *  • `data/accepted-words.txt` — plain text, one word per line
 *
 * All entries are stored lowercase and trimmed.
 *
 * @returns {Set<string>}
 */
function loadDictionary() {
	if (dictionary) return dictionary;

	dictionary = JSON.parse(zlib.brotliDecompressSync(fs.readFileSync(WORDS_PATH)).toString("utf8"));

	return dictionary;
}

// ─── Word helpers ──────────────────────────────────────────────────────────

/**
 * Count the number of syllables (space-separated tokens) in a word.
 * @param {string} word
 * @returns {number}
 */
const countSyllables = (word) => word.trim().split(/\s+/).length;

/**
 * Return the first syllable of a word (lowercased).
 * @param {string} word
 * @returns {string}
 */
const getFirstSyllable = (word) => word.trim().split(/\s+/)[0].toLowerCase();

/**
 * Return the last syllable of a word (lowercased).
 * @param {string} word
 * @returns {string}
 */
const getLastSyllable = (word) => {
	const parts = word.trim().split(/\s+/);
	return parts[parts.length - 1].toLowerCase();
};

/**
 * Check whether a word exists in the dictionary (case-insensitive).
 * @param {string} word
 * @returns {boolean}
 */
function isValidWord(word) {
	const arr = loadDictionary();

	word = word.toLowerCase().trim();

	let left = 0;
	let right = arr.length - 1;

	while (left <= right) {
		const mid = (left + right) >> 1;

		if (arr[mid] === word) {
			return true;
		}

		if (arr[mid] < word) {
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	return false;
}
// ─── Game-state I/O ────────────────────────────────────────────────────────

/**
 * @typedef {Object} GameState
 * @property {string|null} lastWord      — The last accepted word (lowercase).
 * @property {string|null} lastSyllable  — The last syllable of `lastWord`.
 * @property {string|null} lastPlayer    — Discord user ID of the last player.
 * @property {string[]}    usedWords     — All words used in this session.
 */

/** @returns {GameState} */
const _emptyState = () => ({ lastWord: null, lastSyllable: null, lastPlayer: null, usedWords: [] });

function _readAll() {
	if (!fs.existsSync(GAME_STATE_PATH)) {
		fs.writeFileSync(GAME_STATE_PATH, "{}", "utf8");
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(GAME_STATE_PATH, "utf8")) || {};
	} catch {
		return {};
	}
}

function _writeAll(data) {
	fs.writeFileSync(GAME_STATE_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Load the game state for a specific guild.
 * Returns a fresh empty state if none exists.
 * @param {string} guildId
 * @returns {GameState}
 */
function loadGameState(guildId) {
	const all = _readAll();
	return all[guildId] ?? _emptyState();
}

/**
 * Persist the game state for a specific guild.
 * @param {string} guildId
 * @param {GameState} state
 */
function saveGameState(guildId, state) {
	const all = _readAll();
	all[guildId] = state;
	_writeAll(all);
}

/**
 * Delete the game state for a specific guild (used on reset / disable).
 * @param {string} guildId
 */
function resetGameState(guildId) {
	const all = _readAll();
	delete all[guildId];
	_writeAll(all);
}

module.exports = {
	loadDictionary,
	countSyllables,
	getFirstSyllable,
	getLastSyllable,
	isValidWord,
	loadGameState,
	saveGameState,
	resetGameState,
};
