const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
	name: "B_queue_Shuffle",
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

	player.shuffle();

	const QueueTrack = useFunctions().get("Queue");
	QueueTrack.execute(interaction, player, true);
	return;
};
