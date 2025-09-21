const { getPlayer } = require("ziplayer");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
	name: "B_queue_refresh",
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
	if (!player) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });

	const QueueTrack = useFunctions().get("Queue");
	QueueTrack.execute(interaction, player, true);
	return;
};
