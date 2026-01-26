const { useHooks } = require("zihooks");
const { ButtonStyle, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports.data = {
	name: "runAI",
	type: "ai",
};

module.exports.execute = async (interaction, msg, lang) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const result = await useHooks.get("ai").run(msg, interaction.user, lang);

	// Chia kết quả thành các trang
	const chunks = splitIntoChunks(result, 4090); // Chia nhỏ kết quả thành các đoạn
	let currentPage = 0;

	// Tạo embed cho trang hiện tại
	const generateEmbed = (page) => {
		return new EmbedBuilder()
			.setTitle("Kết quả từ AI")
			.setDescription(chunks[page]) // max 4096
			.setFooter({
				text: `Trang ${page + 1} / ${chunks.length}`,
			})
			.setColor("Blue");
	};

	// Nếu chỉ có một trang, gửi luôn
	if (chunks.length === 1) {
		await interaction.editReply({
			embeds: [generateEmbed(0)],
			content: `**__Prompt__**: ${msg}\n\n**__Hỏi bởi__**: ${interaction.user.username}`,
		});
		return;
	}

	// Tạo các nút điều hướng
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(true), // Vô hiệu hóa nút "Trước" ban đầu
		new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Secondary),
	);

	// Gửi tin nhắn ban đầu với trang đầu tiên
	const message = await interaction.editReply({
		embeds: [generateEmbed(currentPage)],
		components: [row],
		content: `**__Prompt__**: ${msg}\n\n**__Hỏi bởi__**: ${interaction.user.username}`,
	});

	// Bộ thu thập (collector) để xử lý các lần bấm nút
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (btnInteraction) => btnInteraction.user.id === interaction.user.id, // Chỉ cho phép người hỏi bấm nút
		time: 60000, // Hết hạn sau 60 giây
	});

	collector.on("collect", async (btnInteraction) => {
		// Xác định nút được bấm
		if (btnInteraction.customId === "prev") {
			currentPage = Math.max(currentPage - 1, 0);
		} else if (btnInteraction.customId === "next") {
			currentPage = Math.min(currentPage + 1, chunks.length - 1);
		}

		// Cập nhật embed và trạng thái nút
		await btnInteraction.update({
			embeds: [generateEmbed(currentPage)],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId("prev")
						.setLabel("◀")
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(currentPage === 0), // Vô hiệu hóa nếu ở trang đầu
					new ButtonBuilder()
						.setCustomId("next")
						.setLabel("▶")
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(currentPage === chunks.length - 1), // Vô hiệu hóa nếu ở trang cuối
				),
			],
		});
	});

	collector.on("end", async () => {
		// Sau khi hết thời gian, vô hiệu hóa các nút
		await interaction.editReply({
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(true),
					new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(true),
				),
			],
		});
	});
};

function splitIntoChunks(text, chunkSize) {
	const chunks = [];
	for (let i = 0; i < text.length; i += chunkSize) {
		chunks.push(text.slice(i, i + chunkSize));
	}
	return chunks;
}
