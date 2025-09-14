const { useFunctions } = require("@zibot/zihooks");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "player",
	description: "Gọi Player",
	type: 1, // slash commad
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } lang
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply({ withResponse: true });
	const player = getPlayer(interaction.guildId);
	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying }).catch((e) => {});
	player.userdata.mess.edit({ components: [] }).catch((e) => {});

	player.userdata.mess = await interaction.fetchReply();

	const player_func = useFunctions().get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	await interaction.editReply(res);
};
