const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_addtext",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	const modal = new ModalBuilder().setCustomId("M_guildcmd_addtext").setTitle("Thêm block Text");
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("content")
				.setLabel("Nội dung (Markdown)")
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(4000)
				.setPlaceholder("## Tiêu đề\nNội dung... Hỗ trợ {user}, {guild.name}, {memberCount}"),
		),
	);

	return interaction.showModal(modal);
};
