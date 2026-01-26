const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_TempVoice_Lock",
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

	const db = useHooks.get("db");
	if (!db || !db.ZiGuild) {
		return interaction.reply({ content: "Cơ sở dữ liệu không khả dụng.", ephemeral: true });
	}

	await interaction.deferReply({ ephemeral: true });
	const config = await db.ZiGuild.findOne({ guildId: interaction.guild.id });
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
	tempChannel.locked = !tempChannel.locked;
	await channel.permissionOverwrites.edit(interaction.guild.id, {
		Connect: !tempChannel.locked,
	});
	await interaction.editReply({
		content: `Kênh thoại đã ${tempChannel.locked ? "bị khóa" : "được mở khóa"}.`,
		ephemeral: true,
	});
	await config.save();
};
