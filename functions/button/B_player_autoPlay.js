const { useFunctions } = require("@zibot/zihooks");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "B_player_autoPlay",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	const player = getPlayer(interaction.guild.id);
	if (!player) return;
	player.autoPlay(!player.autoPlay());
	if (!player.isPlaying) player.skip();
	return;
};
