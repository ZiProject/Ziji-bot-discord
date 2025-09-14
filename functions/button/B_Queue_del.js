const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "B_queue_del",
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
		return interaction.followUp({ content: lang.music.NOvoiceMe, ephemeral: true });

	const modal = new ModalBuilder()
		.setTitle(`Delete Track ${interaction?.guild?.name}`)
		.setCustomId("M_Queue_del")
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId("del-input")
					.setPlaceholder("Track Number")
					.setLabel("Track Number ex: 1,3,4...")
					.setStyle(TextInputStyle.Short)
					.setRequired(true),
			),
		);
	await interaction.showModal(modal);
	return;
};
