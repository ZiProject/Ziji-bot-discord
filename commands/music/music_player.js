const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "player",
	description: "Gọi Player",
	category: "musix",
	type: 1, // slash commad
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang
 * @param {import("ziplayer").Player} command.player - player
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
	await interaction.deferReply({ withResponse: true });
	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying }).catch((e) => {});
	player?.userdata?.mess?.edit({ components: [] }).catch((e) => {});

	player.userdata.mess = await interaction.fetchReply();

	const player_func = useHooks.get("functions").get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	await interaction.editReply(res);
};
