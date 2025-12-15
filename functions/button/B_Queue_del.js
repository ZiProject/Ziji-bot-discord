const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports.data = {
	name: "B_queue_del",
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
	if (!player?.connection) return interaction.reply({ content: lang.music.NoPlaying, ephemeral: true });

	const modal = new ModalBuilder()
		.setTitle(`Delete Track ${interaction?.guild?.name}`)
		.setCustomId("M_Queue_del")
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId("del-input")
					.setPlaceholder("Track Number")
					.setLabel("Track Number ex: 1,3,4...")
					.setStyle(TextInputStyle.Short)
					.setRequired(true),
			),
		);
	await interaction.showModal(modal);
	return;
};
