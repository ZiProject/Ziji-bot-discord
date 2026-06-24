const assert = require("node:assert");
const { test } = require("node:test");
const { useHooks } = require("zihooks");
const { isValidWord, countSyllables } = require("../utility/wordGameUtils");

test("WordGame Utils - Syllable count", () => {
	assert.strictEqual(countSyllables("hành lá"), 2);
	assert.strictEqual(countSyllables("từ"), 1);
	assert.strictEqual(countSyllables("từ này ba âm"), 4);
});

test("WordGame Utils - custom word validation", () => {
	// Initialize cache
	const customWords = new Set(["từ mới", "custom word"]);
	useHooks.set("customWords", customWords);

	// Validate custom word is matched
	assert.strictEqual(isValidWord("từ mới"), true);
	assert.strictEqual(isValidWord("custom word"), true);
	// Validate non-existing word is false
	assert.strictEqual(isValidWord("xyzabc qwert"), false);
});
