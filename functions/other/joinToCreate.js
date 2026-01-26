const { useHooks } = require("zihooks");
const {
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ChannelType,
	PermissionFlagsBits,
	ComponentType,
} = require("discord.js");

module.exports.data = {
	name: "joinToCreate",
	type: "other",
};
let message;
let channelOwner;
let isCurrentlyHidden;

/**
 * Main execute function
 */
/**
 * Hàm để thay thế các biến trong chuỗi bằng giá trị thực tế.
/**
 * @param { import('discord.js').VoiceState } oldState
 * @param { import('discord.js').VoiceState } newState
 */
module.exports.execute = async (oldState, newState, guildSetting) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	// Người dùng join vào kênh JTC
	if (newState.channelId === guildSetting.joinToCreate.voiceChannelId) {
		const channel = await newState.guild.channels
			.create({
				name: `${newState.member.user.username}'s channel`,
				type: ChannelType.GuildVoice,
				parent: guildSetting.joinToCreate.categoryId || newState.member.voice.channel?.parentId,
				userLimit: guildSetting.joinToCreate.defaultUserLimit || newState.member.voice.channel?.userLimit,
				permissionOverwrites: [
					{
						id: newState.member.id,
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.ManageChannels,
							PermissionFlagsBits.DeafenMembers,
							PermissionFlagsBits.MuteMembers,
							PermissionFlagsBits.MoveMembers,
						],
					},
					{
						id: newState.guild.id,
						allow: [PermissionFlagsBits.ViewChannel],
					},
				],
			})
			.catch(() => {
				return;
			});
		// Cập nhật database
		guildSetting.joinToCreate.tempChannels.push({
			channelId: channel.id,
			ownerId: newState.member.user.id,
			locked: false,
		});
		await guildSetting.save();
		await newState.member.voice.setChannel(channel);

		const managerEmbed = new EmbedBuilder()
			.setTitle("Quản lý phòng")
			.setDescription(`Xin chào **${newState.member.user.username}**! Hãy sử dụng các nút để điều khiển phòng thoại nhé`)
			.setColor("Random")
			.setImage(useHooks.get("config").botConfig?.Banner)
			.setFooter({ text: "Nhấn các nút bên dưới để sử dụng giao diện" })
			.setTimestamp();

		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId("B_TempVoice_Lock").setLabel("🔒 Khóa/Mở khóa").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("B_TempVoice_Hide").setLabel("👁️ Ẩn/Hiện kênh thoại").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("B_TempVoice_Kick").setLabel("👢 Đuổi người dùng").setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId("B_TempVoice_Limit").setLabel("👥 Giới hạn người dùng").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("B_TempVoice_Rename").setLabel("✏️ Đổi tên").setStyle(ButtonStyle.Success),
		);

		message = await newState.channel.send({
			content: "",
			embeds: [managerEmbed],
			components: [row1],
		});
	}

	// Xóa kênh nếu trống
	if (oldState.channelId) {
		const tempChannel = guildSetting.joinToCreate.tempChannels.find((ch) => ch.channelId === oldState.channelId);
		if (tempChannel) {
			const channel = oldState.guild.channels.cache.get(oldState.channelId);
			if (channel?.members.filter((member) => !member.user.bot).size === 0) {
				await channel.delete().catch(() => {});
				guildSetting.joinToCreate.tempChannels = guildSetting.joinToCreate.tempChannels.filter(
					(ch) => ch.channelId !== oldState.channelId,
				);
				await guildSetting.save();
			}
		}
	}
};
