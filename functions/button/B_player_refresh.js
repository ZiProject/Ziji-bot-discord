const { useFunctions } = require("@zibot/zihooks");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "B_player_refresh",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferUpdate();
	const player = getPlayer(interaction.guild.id);
	if (!player) return;
	const player_func = useFunctions().get("player_func");

	if (!player_func) return;
	const res = await player_func.execute({ player });
	player.userdata.mess.edit(res);
};
