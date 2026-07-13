const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_addmedia",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	const modal = new ModalBuilder().setCustomId("M_guildcmd_addmedia").setTitle("Thêm block Media");
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("url")
				.setLabel("URL hình ảnh / video")
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(300)
				.setPlaceholder("https://example.com/image.jpg"),
		),
	);

	return interaction.showModal(modal);
};
