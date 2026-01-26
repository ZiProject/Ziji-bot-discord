const { useHooks } = require("zihooks");
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports.data = {
	name: "B_editProfile",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const db = useHooks.get("db");
	if (!db) return interaction.reply({ content: lang?.until?.noDB, ephemeral: true }).catch(() => {});

	let rankkk = await db?.ZiUser?.findOne({ userID: interaction?.user.id }).catch((e) => {});
	if (rankkk.level < 2) return interaction.reply({ content: `${lang?.RankSystem.canLv2}`, ephemeral: true }).catch((e) => {});

	const modal = new ModalBuilder()
		.setCustomId("M_editProfile")
		.setTitle(`Edit profile ${interaction.user.tag} `)
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId("Probcolor")
					.setValue(`${lang.color}`)
					.setLabel(`Color`)
					.setPlaceholder(`${lang?.RankSystem?.hexCOLOR}`)
					.setStyle(TextInputStyle.Short)
					.setRequired(false),
			),
		);
	// await interaction.deferReply({ ephemeral: true }).catch(() => {});
	return interaction?.showModal(modal);
};
