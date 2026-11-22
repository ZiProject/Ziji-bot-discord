const assert = require("node:assert");
const { test } = require("node:test");
const font = require("../commands/fun/font");

test("Font - preserves Vietnamese text and emoji while styling ASCII", () => {
	const bold = font.mapAlphabet("Xin chào! 123 😀", "Bold");

	assert.strictEqual(bold.includes("Xin"), false);
	assert.match(bold, /𝐗𝐢𝐧/);
	assert.ok(bold.includes("à"));
	assert.ok(bold.includes("𝐨"));
	assert.ok(bold.includes("𝟏𝟐𝟑"));
	assert.ok(bold.includes("😀"));
	assert.strictEqual(font.mapAlphabet("ABC 123", "Bold"), "𝐀𝐁𝐂 𝟏𝟐𝟑");
});

test("Font - supports common special-character sets", () => {
	assert.strictEqual(font.fullwidth("A1"), "Ａ１");
	assert.strictEqual(font.circled("A1"), "Ⓐ①");
	assert.strictEqual(font.parenthesized("A1"), "🄐⑴");
	assert.strictEqual(font.squared("AZ"), "🄰🅉");
	assert.strictEqual(font.negativeSquared("AZ"), "🅰🆉");
	assert.strictEqual(font.regionalIndicator("Az"), "🇦🇿");
	assert.strictEqual(font.superscript("n 123"), "ⁿ ¹²³");
	assert.strictEqual(font.subscript("a123"), "ₐ₁₂₃");
});

test("Font - stylize includes multiple real special-character styles", () => {
	const names = font.stylize("Test").map(([name]) => name);

	assert.ok(names.includes("Bold"));
	assert.ok(names.includes("Bold Fraktur"));
	assert.ok(names.includes("Antrophobia"));
	assert.ok(names.includes("Sans Serif Bold"));
	assert.ok(names.includes("Sans Serif Italic"));
	assert.ok(names.includes("Sans Serif Bold Italic"));
	assert.ok(names.includes("Circled"));
	assert.ok(names.includes("Negative circled"));
	assert.ok(names.includes("Squared"));
	assert.ok(names.includes("Regional indicator"));
	assert.ok(names.includes("Superscript"));
	assert.ok(names.includes("Subscript"));
	assert.ok(names.includes("Light Text Bubbles"));
	assert.ok(names.includes("Seagull"));
	assert.ok(names.includes("Thai decorative"));
	assert.ok(names.includes("Cyrillic decorative"));
	assert.ok(names.includes("Esoteric"));
	assert.ok(names.includes("Greek decorative"));
});

test("Font - supports named decorative alphabets", () => {
	assert.strictEqual(font.mapAlphabet("ABC", "Bold Fraktur"), "𝕬𝕭𝕮");
	assert.strictEqual(font.mapAlphabet("abc", "Antrophobia"), "𝒶𝒷𝒸");
	assert.strictEqual(font.mapAlphabet("ABC 123", "Sans Serif Bold"), "𝗔𝗕𝗖 𝟭𝟮𝟯");
	assert.strictEqual(font.seagull("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), "ᗩᗷᑕᗪEᖴGᕼIᒍKᒪᗰᑎOᑭᑫᖇSTᑌᐯᗯ᙭Yᘔ");
	assert.strictEqual(font.fullwidth("A1"), "Ａ１");
});
