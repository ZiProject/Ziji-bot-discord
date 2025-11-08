const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports.data = {
	name: "B_filter_modal",
	type: "button",
	category: "musix",
	lock: true,
	ckeckVoice: true,
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @param {import("ziplayer").Player} button.player - player
 * @returns
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying, ephemeral: true });

	const modal = new ModalBuilder()
		.setTitle("Applied Fillter")
		.setCustomId("M_filter")
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId("filter-input")
					.setLabel("Filter input")
					.setPlaceholder("Filter name ex: bassboost, treble, etc., rm.bassboost, rm.treble, etc.")
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true),
			),
		);
	await interaction.showModal(modal);
	return interaction.editReply({ content: lang.music.filterApplied }).catch((e) => {});
};
