const { useFunctions } = require("@zibot/zihooks");
const Functions = useFunctions();
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "S_player_Fillter",
	type: "SelectMenu",
};

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { client, user, values } = interaction;
	const player = getPlayer(interaction.guild.id);
	if (!player) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	// Kiểm tra xem có khóa player không
	if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id)
		return interaction.followUp({ content: lang.until.noPermission, ephemeral: true });

	if (player.userdata.requestedBy?.id !== user.id) {
		return interaction.reply({ content: "You cannot interact with this menu.", ephemeral: true });
	}
	const fillter = values?.at(0);
	const Fillter = Functions.get("Fillter");

	const player_func = Functions.get("player_func");
	await interaction?.deferUpdate().catch((e) => {});
	await Fillter.execute(interaction, fillter);

	player.userdata.mess.edit(await player_func.execute({ player }));
	return;
};
