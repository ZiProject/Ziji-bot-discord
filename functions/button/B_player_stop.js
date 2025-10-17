const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "B_player_stop",
	type: "button",
	category: "musix",
	lock: true,
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferUpdate().catch(() => {});
	interaction.message.edit({ components: [] }).catch((e) => {});
	const player = getPlayer(interaction.guild.id);
	player?.destroy?.();
};
