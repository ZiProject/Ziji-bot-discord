const { useHooks } = require("zihooks");

module.exports.data = {
	name: "M_TempVoice_limit",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

let limit = 0;
module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	await interaction.deferReply();
	const config = await useHooks.get("db").ZiGuild.findOne({ guildId: interaction.guild.id });
	if (!config?.joinToCreate.enabled) return interaction.editReply("❌ | Chức năng này chưa được bật ở máy chủ này");
	const tempChannel = await config.joinToCreate.tempChannels.find((tc) => tc.channelId === interaction.channel.id);
	if (!tempChannel) return;
	const channel = interaction.guild.channels.cache.get(tempChannel.channelId);
	if (!channel) return;
	limit = parseInt(interaction.fields.getTextInputValue("userLimit"));
	if (isNaN(limit) || limit < 0 || limit > 99)
		return interaction.editReply({
			content: "❌ | Bạn cần cung cấp một số lớn hơn 0 và nhỏ hơn 99",
			ephemeral: true,
		});
	await channel.setUserLimit(limit);
	await interaction.editReply({ content: `✅ | Đã chỉnh giới hạn người dùng thành ${limit} người.`, ephemeral: true });
};
