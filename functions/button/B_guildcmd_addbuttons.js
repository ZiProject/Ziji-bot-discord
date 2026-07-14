const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_addbuttons",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	const modal = new ModalBuilder().setCustomId("M_guildcmd_addbuttons").setTitle("Thêm block Buttons");
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("buttonsJson")
				.setLabel("Buttons JSON (mảng)")
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(2000)
				.setPlaceholder('[{"style":"primary","label":"Open","customId":"open"}]'),
		),
	);

	return interaction.showModal(modal);
};
