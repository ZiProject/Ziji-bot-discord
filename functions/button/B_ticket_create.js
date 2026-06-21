const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { useHooks } = require("zihooks");
module.exports.data = {
	name: "B_ticket_create",
	type: "button",
};

/**
 * @param { object } params - Parameters object
 * @param { import("discord.js").ButtonInteraction } params.interaction - interaction
 * @param { object } params.lang - language object
 */
module.exports.execute = async ({ interaction, lang }) => {
	const modal = new ModalBuilder().setCustomId("M_ticket_create").setTitle("Tạo Ticket");
	const reasonInput = new TextInputBuilder()
		.setCustomId("reason")
		.setLabel("Lý do tạo ticket")
		.setPlaceholder("Nhập lý do...")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true);
	const row = new ActionRowBuilder().addComponents(reasonInput);
	modal.addComponents(row);
	await interaction.showModal(modal);
};
