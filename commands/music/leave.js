const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "leave",
	description: "Tắt nhạc và rời khỏi kênh thoại",
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
	await interaction.deferReply();
	const player = getPlayer(interaction.guild.id);
	if (!player.connection) {
		await interaction?.guild?.members?.me?.voice?.disconnect();
		await interaction.editReply(lang.music.Disconnect);
		return;
	}
	if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id) return;
	await player.userdata?.mess?.edit({ components: [] }).catch((e) => {});
	player.destroy();
	await interaction.editReply(lang.music.DisconnectDes);
};
