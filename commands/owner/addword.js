"use strict";

const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { useHooks } = require("zihooks");
const { countSyllables, isValidWord } = require("../../utility/wordGameUtils");

module.exports.data = {
	name: "addword",
	description: "Thêm từ tùy chỉnh vào trò chơi nối từ (Chủ bot)",
	type: 1, // slash command
	options: [
		{
			name: "words",
			description: "Các từ cần thêm, phân cách bằng dấu phẩy, chấm phẩy hoặc dòng mới",
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	integration_types: [0],
	contexts: [0],
	owner: true,
};

module.exports.execute = async ({ interaction, lang }) => {
	const config = useHooks.get("config");

	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id)) {
		return interaction.reply({
			content: lang?.until?.noPermission || "❌ Bạn không có quyền sử dụng lệnh này!",
			ephemeral: true,
		});
	}

	await interaction.deferReply({ flags: 64 }); // Ephemeral flag

	const db = useHooks.get("db");
	if (!db) {
		return interaction.editReply({ content: "❌ Cơ sở dữ liệu hiện không khả dụng." });
	}

	const wordsInput = interaction.options.getString("words");
	// Split by newline, comma, or semicolon
	const rawWords = wordsInput.split(/[\n,;]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);

	const added = [];
	const existing = [];
	const invalid = [];

	const customWords = useHooks.get("customWords") || new Set();

	for (const word of rawWords) {
		if (countSyllables(word) !== 2) {
			invalid.push(word);
			continue;
		}

		if (isValidWord(word)) {
			existing.push(word);
			continue;
		}

		try {
			await db.ZiData.create({
				type: "wordgame_words",
				key: word,
				value: JSON.stringify({
					addedBy: interaction.user.id,
					addedAt: new Date(),
				}),
			});

			customWords.add(word);
			added.push(word);
		} catch (error) {
			console.error(`Error saving word "${word}":`, error);
			invalid.push(word);
		}
	}

	// Update the cache hook in case it was re-created
	useHooks.set("customWords", customWords);

	const embed = new EmbedBuilder()
		.setTitle("📝 Kết quả thêm từ tùy chỉnh")
		.setColor(lang?.color || "Random")
		.setTimestamp();

	if (added.length > 0) {
		embed.addFields({
			name: `✅ Đã thêm thành công (${added.length})`,
			value: added.map((w) => `\`${w}\``).join(", ").substring(0, 1024) || "None",
		});
	}

	if (existing.length > 0) {
		embed.addFields({
			name: `⚠️ Đã tồn tại (${existing.length})`,
			value: existing.map((w) => `\`${w}\``).join(", ").substring(0, 1024) || "None",
		});
	}

	if (invalid.length > 0) {
		embed.addFields({
			name: `❌ Không hợp lệ (Không phải 2 âm tiết hoặc lỗi) (${invalid.length})`,
			value: invalid.map((w) => `\`${w}\``).join(", ").substring(0, 1024) || "None",
		});
	}

	if (added.length === 0 && existing.length === 0 && invalid.length === 0) {
		embed.setDescription("Không tìm thấy từ nào hợp lệ để xử lý.");
	}

	await interaction.editReply({ embeds: [embed] });
};
