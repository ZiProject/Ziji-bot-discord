const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_player_pause",
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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	await interaction.deferUpdate().catch(() => {});
	if (!player?.connection) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	player.isPaused ? player.resume() : player.pause();

	const playerGui = useHooks.get("functions").get("playerGui");
	if (!playerGui) return;
	const res = await playerGui.execute({ player });
	player.userdata.mess.edit(res);
};
