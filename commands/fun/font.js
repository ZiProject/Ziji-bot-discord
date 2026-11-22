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
  "Bold": {
    upper: 0x1d400,
    lower: 0x1d41a,
  },
  "Bold italic": {
    upper: 0x1d468,
    lower: 0x1d482,
  },
  "Double-struck": {
    upper: 0x1d538,
    lower: 0x1d552,
    exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  "Monospace": {
    upper: 0x1d670,
    lower: 0x1d68a,
  },
  "Fraktur": {
    upper: 0x1d504,
    lower: 0x1d51e,
    exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  },
};

function mapAlphabet(text, style) {
  const { upper, lower, exceptions = {} } = ranges[style];
  return Array.from(text, (character) => {
    const code = character.codePointAt(0);
    if (character >= "A" && character <= "Z") {
      return String.fromCodePoint(exceptions[character] ?? upper + code - 65);
    }
    if (character >= "a" && character <= "z") {
      return String.fromCodePoint(lower + code - 97);
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

function smallCaps(text) {
  const replacements = {
    a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ",
    h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ",
    o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ",
    v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
  };
  return Array.from(text, (character) => replacements[character.toLowerCase()] ?? character).join("");
}

function stylize(text) {
  return [
    ["Original", text],
    ...Object.keys(ranges).map((style) => [style, mapAlphabet(text, style)]),
    ["Fullwidth", fullwidth(text)],
    ["Circled", circled(text)],
    ["Small caps", smallCaps(text)],
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
  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("✨ Unicode Font Generator")
    .setDescription("Chọn kiểu chữ bạn thích rồi sao chép kết quả bên dưới.")
    .addFields(
      results.map(([name, value]) => ({
        name,
        value: "`" + value.replace(/`/g, "ˋ") + "`",
        inline: true,
      })),
    )
    .setFooter({ text: "Một số ứng dụng hoặc font chữ có thể không hỗ trợ mọi ký tự Unicode." });

  return interaction.reply({ embeds: [embed] });
};
