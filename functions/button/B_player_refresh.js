const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_player_refresh",
	type: "button",
	category: "musix",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
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

	const player_func = useHooks.get("functions").get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	player.userdata.mess.edit(res);
};
