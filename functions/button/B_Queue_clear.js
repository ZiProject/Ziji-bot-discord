module.exports.data = {
	name: "B_queue_clear",
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
	await interaction.deferUpdate().catch(() => {});
	if (!player?.connection) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	player.clearQueue();
	interaction.message.delete().catch((e) => {});
	return;
};
