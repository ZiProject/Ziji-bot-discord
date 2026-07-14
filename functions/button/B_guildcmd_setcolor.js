const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_setcolor",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	const modal = new ModalBuilder().setCustomId("M_guildcmd_setcolor").setTitle("Đặt màu accent");
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("color")
				.setLabel("RGB — vd: 88,101,242")
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(20)
				.setValue((session.layout.accentColor || [88, 101, 242]).join(",")),
		),
	);

	return interaction.showModal(modal);
};
