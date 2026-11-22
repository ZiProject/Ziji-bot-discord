"use strict";

/**
 * /font — Convert text into decorative Unicode styles.
 *
 * Mathematical alphanumeric symbols are used where available. Characters
 * outside the supported Latin ranges (including Vietnamese accents) are
 * preserved instead of being silently dropped.
 */

const { EmbedBuilder } = require("discord.js");

const ranges = {
	"Sans-serif italic": {
		upper: 0x1d608,
		lower: 0x1d622,
	},
	"Sans Serif Italic": {
		upper: 0x1d608,
		lower: 0x1d622,
	},
	"Sans-serif bold": {
		upper: 0x1d5d4,
		lower: 0x1d5ee,
		digit: 0x1d7ec,
	},
	"Sans Serif Bold": {
		upper: 0x1d5d4,
		lower: 0x1d5ee,
		digit: 0x1d7ec,
	},
	"Sans-serif bold italic": {
		upper: 0x1d63c,
		lower: 0x1d656,
		digit: 0x1d7ec,
	},
	"Sans Serif Bold Italic": {
		upper: 0x1d63c,
		lower: 0x1d656,
		digit: 0x1d7ec,
	},
	Bold: {
		upper: 0x1d400,
		lower: 0x1d41a,
		digit: 0x1d7ce,
	},
	"Serif Italic": {
		upper: 0x1d434,
		lower: 0x1d44e,
		exceptions: { h: 0x210e },
	},
	"Bold italic": {
		upper: 0x1d468,
		lower: 0x1d482,
	},
	"Double-struck": {
		upper: 0x1d538,
		lower: 0x1d552,
		digit: 0x1d7d8,
		exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
	},
	Monospace: {
		upper: 0x1d670,
		lower: 0x1d68a,
		digit: 0x1d7f6,
	},
	Fraktur: {
		upper: 0x1d504,
		lower: 0x1d51e,
		exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
	},
	"Bold Fraktur": {
		upper: 0x1d56c,
		lower: 0x1d586,
	},
	Antrophobia: {
		upper: 0x1d49c,
		lower: 0x1d4b6,
		exceptions: {
			B: 0x212c,
			E: 0x2130,
			F: 0x2131,
			H: 0x210b,
			I: 0x2110,
			L: 0x2112,
			M: 0x2133,
			R: 0x211b,
			e: 0x1d452,
			o: 0x1d45c,
		},
	},
};

function mapAlphabet(text, style) {
	const { upper, lower, digit, exceptions = {} } = ranges[style];
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (character >= "A" && character <= "Z") {
			return String.fromCodePoint(exceptions[character] ?? upper + code - 65);
		}
		if (character >= "a" && character <= "z") {
			return String.fromCodePoint(exceptions[character] ?? lower + code - 97);
		}
		if (digit && character >= "0" && character <= "9") {
			return String.fromCodePoint(digit + code - 48);
		}
		return character;
	}).join("");
}

function fullwidth(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 0x21 && code <= 0x7e) return String.fromCodePoint(code + 0xfee0);
		if (character === " ") return "\u3000";
		return character;
	}).join("");
}

function circled(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) return String.fromCodePoint(0x24b6 + code - 65);
		if (code >= 97 && code <= 122) return String.fromCodePoint(0x24d0 + code - 97);
		if (code >= 49 && code <= 57) return String.fromCodePoint(0x2460 + code - 49);
		if (character === "0") return "⓪";
		return character;
	}).join("");
}

function negativeCircled(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) {
			const letterIndex = code - 65;
			if (letterIndex <= 19) return String.fromCodePoint(0x1f150 + letterIndex);
		}
		if (code >= 49 && code <= 57) return String.fromCodePoint(0x2776 + code - 49);
		if (character === "0") return "⓿";
		return character;
	}).join("");
}

function squared(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) return String.fromCodePoint(0x1f130 + code - 65);
		return character;
	}).join("");
}

function negativeSquared(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) return String.fromCodePoint(0x1f170 + code - 65);
		return character;
	}).join("");
}

function parenthesized(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) return String.fromCodePoint(0x1f110 + code - 65);
		if (code >= 97 && code <= 122) return String.fromCodePoint(0x249c + code - 97);
		if (code >= 49 && code <= 57) return String.fromCodePoint(0x2474 + code - 49);
		if (character === "0") return "⓪";
		return character;
	}).join("");
}

function regionalIndicator(text) {
	return Array.from(text, (character) => {
		const code = character.codePointAt(0);
		if (code >= 65 && code <= 90) return String.fromCodePoint(0x1f1e6 + code - 65);
		if (code >= 97 && code <= 122) return String.fromCodePoint(0x1f1e6 + code - 97);
		return character;
	}).join("");
}

function superscript(text) {
	const replacements = {
		a: "ᵃ",
		b: "ᵇ",
		c: "ᶜ",
		d: "ᵈ",
		e: "ᵉ",
		f: "ᶠ",
		g: "ᶢ",
		h: "ʰ",
		i: "ⁱ",
		j: "ʲ",
		k: "ᵏ",
		l: "ˡ",
		m: "ᵐ",
		n: "ⁿ",
		o: "ᵒ",
		p: "ᵖ",
		r: "ʳ",
		s: "ˢ",
		t: "ᵗ",
		u: "ᵘ",
		v: "ᵛ",
		w: "ʷ",
		x: "ˣ",
		y: "ʸ",
		z: "ᶻ",
		0: "⁰",
		1: "¹",
		2: "²",
		3: "³",
		4: "⁴",
		5: "⁵",
		6: "⁶",
		7: "⁷",
		8: "⁸",
		9: "⁹",
		"+": "⁺",
		"-": "⁻",
		"=": "⁼",
		"(": "⁽",
		")": "⁾",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function subscript(text) {
	const replacements = {
		a: "ₐ",
		e: "ₑ",
		h: "ₕ",
		i: "ᵢ",
		j: "ⱼ",
		k: "ₖ",
		l: "ₗ",
		m: "ₘ",
		n: "ₙ",
		o: "ₒ",
		p: "ₚ",
		r: "ᵣ",
		s: "ₛ",
		t: "ₜ",
		u: "ᵤ",
		v: "ᵥ",
		x: "ₓ",
		0: "₀",
		1: "₁",
		2: "₂",
		3: "₃",
		4: "₄",
		5: "₅",
		6: "₆",
		7: "₇",
		8: "₈",
		9: "₉",
		"+": "₊",
		"-": "₋",
		"=": "₌",
		"(": "₍",
		")": "₎",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function smallCaps(text) {
	const replacements = {
		a: "ᴀ",
		b: "ʙ",
		c: "ᴄ",
		d: "ᴅ",
		e: "ᴇ",
		f: "ꜰ",
		g: "ɢ",
		h: "ʜ",
		i: "ɪ",
		j: "ᴊ",
		k: "ᴋ",
		l: "ʟ",
		m: "ᴍ",
		n: "ɴ",
		o: "ᴏ",
		p: "ᴘ",
		q: "ǫ",
		r: "ʀ",
		s: "ꜱ",
		t: "ᴛ",
		u: "ᴜ",
		v: "ᴠ",
		w: "ᴡ",
		x: "x",
		y: "ʏ",
		z: "ᴢ",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function seagull(text) {
	const replacements = {
		a: "ᗩ",
		b: "ᗷ",
		c: "ᑕ",
		d: "ᗪ",
		e: "E",
		f: "ᖴ",
		g: "G",
		h: "ᕼ",
		i: "I",
		j: "ᒍ",
		k: "K",
		l: "ᒪ",
		m: "ᗰ",
		n: "ᑎ",
		o: "O",
		p: "ᑭ",
		q: "ᑫ",
		r: "ᖇ",
		s: "S",
		t: "T",
		u: "ᑌ",
		v: "ᐯ",
		w: "ᗯ",
		x: "᙭",
		y: "Y",
		z: "ᘔ",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function thaiStyle(text) {
	const replacements = {
		a: "ค",
		b: "๒",
		c: "ς",
		d: "๔",
		e: "є",
		f: "Ŧ",
		g: "ﻮ",
		h: "ђ",
		i: "เ",
		j: "ן",
		k: "к",
		l: "l",
		m: "๓",
		n: "ภ",
		o: "๏",
		p: "p",
		q: "๑",
		r: "г",
		s: "ร",
		t: "Շ",
		u: "ย",
		v: "ש",
		w: "ฬ",
		x: "x",
		y: "ฯ",
		z: "z",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function cyrillicStyle(text) {
	const replacements = {
		a: "а",
		b: "в",
		c: "с",
		d: "ԁ",
		e: "е",
		f: "ғ",
		g: "ԍ",
		h: "н",
		i: "і",
		j: "ј",
		k: "к",
		l: "ӏ",
		m: "м",
		n: "и",
		o: "о",
		p: "р",
		q: "ԛ",
		r: "г",
		s: "ѕ",
		t: "т",
		u: "ц",
		v: "ѵ",
		w: "ш",
		x: "х",
		y: "у",
		z: "з",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function esotericStyle(text) {
	const replacements = {
		a: "ą",
		b: "ҍ",
		c: "ç",
		d: "ժ",
		e: "ҽ",
		f: "ƒ",
		g: "ց",
		h: "ħ",
		i: "ì",
		j: "ʝ",
		k: "ƙ",
		l: "Ӏ",
		m: "ʍ",
		n: "ղ",
		o: "օ",
		p: "ρ",
		q: "զ",
		r: "ɾ",
		s: "ʂ",
		t: "է",
		u: "մ",
		v: "ν",
		w: "ա",
		x: "×",
		y: "ყ",
		z: "Ⴤ",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function greekStyle(text) {
	const replacements = {
		a: "α",
		b: "ɓ",
		c: "ç",
		d: "ɗ",
		e: "ε",
		f: "ƒ",
		g: "ɠ",
		h: "ɦ",
		i: "ι",
		j: "ʝ",
		k: "ƙ",
		l: "ɭ",
		m: "ɱ",
		n: "ռ",
		o: "σ",
		p: "ρ",
		q: "ϙ",
		r: "ɾ",
		s: "ʂ",
		t: "ƭ",
		u: "υ",
		v: "υ",
		w: "ω",
		x: "×",
		y: "ყ",
		z: "ȥ",
	};
	return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function stylize(text) {
	return [
		["Original", text],
		...Object.keys(ranges).map((style) => [style, mapAlphabet(text, style)]),
		["Fullwidth", fullwidth(text)],
		["Circled", circled(text)],
		["Negative circled", negativeCircled(text)],
		["Squared", squared(text)],
		["Negative squared", negativeSquared(text)],
		["Parenthesized", parenthesized(text)],
		["Regional indicator", regionalIndicator(text)],
		["Superscript", superscript(text)],
		["Subscript", subscript(text)],
		["Small caps", smallCaps(text)],
		["Light Text Bubbles", circled(text)],
		["Seagull", seagull(text)],
		["Thai decorative", thaiStyle(text)],
		["Cyrillic decorative", cyrillicStyle(text)],
		["Esoteric", esotericStyle(text)],
		["Greek decorative", greekStyle(text)],
	];
}

module.exports.data = {
	name: "font",
	description: "Tạo kiểu chữ Unicode và ký tự đặc biệt",
	type: 1,
	integration_types: [0, 1],
	contexts: [0, 1, 2],
	options: [
		{
			name: "text",
			description: "Nhập nội dung muốn tạo kiểu chữ",
			type: 3,
			required: true,
			max_length: 100,
		},
	],
};

module.exports.execute = async ({ interaction }) => {
	const input = interaction.options.getString("text", true).trim();
	if (!input) {
		return interaction.reply({ content: "⚠️ Vui lòng nhập nội dung cần chuyển đổi.", ephemeral: true });
	}

	const results = stylize(input);
	const fields = results.map(([name, value]) => ({
		name,
		value: "`" + value.replace(/`/g, "ˋ").replace(/[\r\n]+/g, " ") + "`",
		inline: true,
	}));
	const embed = new EmbedBuilder()
		.setColor(0x8b5cf6)
		.setTitle("✨ Unicode Font Generator")
		.setDescription("Chọn kiểu chữ bạn thích rồi sao chép kết quả bên dưới.")
		.addFields(fields.slice(0, 25))
		.setFooter({ text: "Một số ứng dụng hoặc font chữ có thể không hỗ trợ mọi ký tự Unicode." });

	const embeds = [embed];
	if (fields.length > 25) {
		embeds.push(
			new EmbedBuilder()
				.setColor(0x8b5cf6)
				.setTitle("✨ Các kiểu ký tự bổ sung")
				.addFields(fields.slice(25))
				.setFooter({ text: "Một số ứng dụng hoặc font chữ có thể không hỗ trợ mọi ký tự Unicode." }),
		);
	}

	return interaction.reply({ embeds });
};

module.exports.stylize = stylize;
module.exports.mapAlphabet = mapAlphabet;
module.exports.fullwidth = fullwidth;
module.exports.circled = circled;
module.exports.negativeCircled = negativeCircled;
module.exports.squared = squared;
module.exports.negativeSquared = negativeSquared;
module.exports.parenthesized = parenthesized;
module.exports.regionalIndicator = regionalIndicator;
module.exports.superscript = superscript;
module.exports.subscript = subscript;
module.exports.smallCaps = smallCaps;
module.exports.seagull = seagull;
module.exports.thaiStyle = thaiStyle;
module.exports.cyrillicStyle = cyrillicStyle;
module.exports.esotericStyle = esotericStyle;
module.exports.greekStyle = greekStyle;
