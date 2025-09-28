/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

module.exports.data = {
	name: "M_TempVoice_Kick",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { guild, customId, fields } = interaction;
	// Lấy thông tin từ modal
	const kickUserId = fields.getTextInputValue("kickUserId");
	const config = await this.db.ZiGuild.findOne({ guildId: interaction.guild.id });
	if (!config?.joinToCreate.enabled) return interaction.editReply("❌ | Chức năng này chưa được bật ở máy chủ này");

	// Kiểm tra xem người dùng có tồn tại và đang ở trong kênh thoại
	const targetMember = guild.members.cache.get(kickUserId);
	const tempChannel = await config.joinToCreate.tempChannels.find((tc) => tc.channelId === interaction.channel.id);
	if (!tempChannel) return;
	const channel = interaction.guild.channels.cache.get(tempChannel.channelId);

	if (!targetMember) {
		return interaction.reply({
			content: "Người dùng không tồn tại trong server.",
			ephemeral: true,
		});
	}

	if (!channel || !channel.members.has(kickUserId)) {
		return interaction.reply({
			content: "Người dùng không ở trong kênh thoại của bạn.",
			ephemeral: true,
		});
	}

	try {
		// Đuổi người dùng
		await targetMember.voice.setChannel(null);
		await interaction.reply({
			content: `Đã đuổi **${targetMember.user.tag}** ra khỏi kênh thoại.`,
			ephemeral: true,
		});
	} catch (error) {
		console.error(error);
		await interaction.reply({
			content: "Đã xảy ra lỗi khi đuổi người dùng.",
			ephemeral: true,
		});
	}
};
