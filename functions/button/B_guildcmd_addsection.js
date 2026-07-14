const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_addsection",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	const modal = new ModalBuilder().setCustomId("M_guildcmd_addsection").setTitle("Thêm block Section");
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("content")
				.setLabel("Nội dung section")
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(4000)
				.setPlaceholder("## Tiêu đề\nMô tả ngắn..."),
		),
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("buttonJson")
				.setLabel("Button accessory (JSON, tùy chọn)")
				.setStyle(TextInputStyle.Short)
				.setRequired(false)
				.setMaxLength(300)
				.setPlaceholder('{"style":"primary","label":"Chi tiết","customId":"details"}'),
		),
	);

	return interaction.showModal(modal);
};
