const { useFunctions } = require("@zibot/zihooks");

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
	await interaction.deferUpdate().catch(() => {});
	if (!player?.connection) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	player.isPaused ? player.resume() : player.pause();

	const player_func = useFunctions().get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	player.userdata.mess.edit(res);
};
