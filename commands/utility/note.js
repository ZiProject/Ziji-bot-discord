const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "note",
	description: "Quản lý ghi chú cá nhân của bạn",
	type: 1,
	options: [
		{
			name: "add",
			description: "Thêm một ghi chú mới",
			type: 1,
			options: [
				{
					name: "title",
					description: "Tiêu đề ghi chú",
					type: 3,
					required: true,
				},
				{
					name: "content",
					description: "Nội dung ghi chú",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "list",
			description: "Danh sách các ghi chú của bạn",
			type: 1,
		},
		{
			name: "delete",
			description: "Xóa một ghi chú",
			type: 1,
			options: [
				{
					name: "id",
					description: "ID của ghi chú (lấy từ lệnh list)",
					type: 3,
					required: true,
				},
			],
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

module.exports.execute = async ({ interaction, lang }) => {
	const subCommand = interaction.options.getSubcommand();
	const DataBase = useHooks.get("db");

	if (!DataBase || !DataBase.ZiNote) {
		return await interaction.reply({
			content: "❌ Hệ thống database chưa sẵn sàng!",
			ephemeral: true,
		});
	}

	if (subCommand === "add") {
		const title = interaction.options.getString("title");
		const content = interaction.options.getString("content");

		const newNote = await DataBase.ZiNote.create({
			userID: interaction.user.id,
			title,
			content,
		});

		const embed = new EmbedBuilder()
			.setTitle("📝 Đã thêm ghi chú!")
			.setColor("#00FF00")
			.addFields(
				{ name: "Tiêu đề", value: title },
				{ name: "Nội dung", value: content.length > 1024 ? content.substring(0, 1021) + "..." : content },
				{ name: "ID", value: `\`${newNote.id}\`` },
			)
			.setTimestamp();

		return await interaction.reply({ embeds: [embed] });
	}

	if (subCommand === "list") {
		const notes = await DataBase.ZiNote.find({ userID: interaction.user.id });

		if (notes.length === 0) {
			return await interaction.reply({
				content: "Bạn chưa có ghi chú nào!",
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle("📑 Danh sách ghi chú của bạn")
			.setColor("#0099FF")
			.setDescription(notes.map((n, i) => `**${i + 1}. ${n.title}**\nID: \`${n.id}\``).join("\n\n"))
			.setFooter({ text: "Sử dụng /note delete <id> để xóa ghi chú" })
			.setTimestamp();

		return await interaction.reply({ embeds: [embed] });
	}

	if (subCommand === "delete") {
		const noteId = interaction.options.getString("id");

		const note = await DataBase.ZiNote.findOne({ id: noteId, userID: interaction.user.id });
		if (!note) {
			return await interaction.reply({
				content: "❌ Không tìm thấy ghi chú hoặc bạn không có quyền xóa nó!",
				ephemeral: true,
			});
		}

		await DataBase.ZiNote.findByIdAndDelete(noteId);

		return await interaction.reply({
			content: `✅ Đã xóa ghi chú: **${note.title}**`,
		});
	}
};
