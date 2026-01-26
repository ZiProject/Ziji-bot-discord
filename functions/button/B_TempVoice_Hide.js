const { useHooks } = require("zihooks");
const { PermissionFlagsBits } = require("discord.js");

module.exports.data = {
	name: "B_TempVoice_Hide",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	await interaction.deferReply({ ephemeral: true });
	const config = await useHooks.get("db").ZiGuild.findOne({ guildId: interaction.guild.id });
	if (!config?.joinToCreate.enabled) return interaction.editReply("❌ | Chức năng này chưa được bật ở máy chủ này");
	const tempChannel = await config.joinToCreate.tempChannels.find((tc) => tc.channelId === interaction.channel.id);
	if (!tempChannel) return;
	const channel = interaction.guild.channels.cache.get(tempChannel.channelId);
	if (!channel) return;
	if (interaction.user.id !== tempChannel.ownerId) {
		return interaction.editReply({
			content: "Bạn không có quyền điều khiển kênh này!",
			ephemeral: true,
		});
	}
	const currentPermissions = channel.permissionOverwrites.cache.get(interaction.guild.id);
	const isCurrentlyHidden = currentPermissions?.deny?.has(PermissionFlagsBits.ViewChannel);
	await channel.permissionOverwrites.edit(interaction.guild.id, {
		ViewChannel: isCurrentlyHidden,
	});
	await interaction.editReply({
		content: `Kênh thoại đã được ${isCurrentlyHidden ? "hiển thị" : "ẩn"}.`,
		ephemeral: true,
	});
};
