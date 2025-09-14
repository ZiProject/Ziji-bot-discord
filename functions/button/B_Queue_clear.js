const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "B_queue_clear",
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

	// Kiểm tra xem có khóa player không
	if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id)
		return interaction.followUp({ content: lang.until.noPermission, ephemeral: true });

	// Kiểm tra xem người dùng có ở cùng voice channel với bot không
	const botVoiceChannel = interaction.guild.members.me.voice.channel;
	const userVoiceChannel = interaction.member.voice.channel;
	if (!botVoiceChannel || botVoiceChannel.id !== userVoiceChannel?.id)
		return interaction.reply({ content: lang.music.NOvoiceMe, ephemeral: true });

	player.clearQueue();
	interaction.message.delete().catch((e) => {});
	return;
};
