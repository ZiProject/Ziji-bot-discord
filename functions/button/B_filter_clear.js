const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports.data = {
	name: "B_filter_clear",
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

	await player?.filter.clearAll();
	return interaction.editReply({ content: lang.music.filterCleared }).catch((e) => {});
};
