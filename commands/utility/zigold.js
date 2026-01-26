const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

const zigoldEmoji = "🪙"; // ZiGold emoji

module.exports.data = {
	name: "zigold",
	description: "Kiểm tra số dư ZiGold của bạn",
	type: 1,
	options: [
		{
			name: "user",
			description: "Kiểm tra ZiGold của người dùng khác",
			type: 6,
			required: false,
		},
	],
	integration_types: [0],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import("../../lang/vi.js") } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	const targetUser = interaction.options.getUser("user") || interaction.user;
	const DataBase = useHooks.get("db");

	let coin = 0;
	let level = 1;
	let xp = 1;

	try {
		if (DataBase) {
			const userDB = await DataBase.ZiUser.findOne({ userID: targetUser.id });
			if (userDB) {
				coin = userDB.coin || 0;
				level = userDB.level || 1;
				xp = userDB.xp || 1;
			}
		} else {
			const errorEmbed = new EmbedBuilder()
				.setTitle("❌ Lỗi Database")
				.setColor("#FF0000")
				.setDescription("Không thể kết nối đến database. Vui lòng thử lại sau!");
			return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
		}
	} catch (error) {
		console.error("ZiGold command error:", error);
		const errorEmbed = new EmbedBuilder()
			.setTitle("❌ Lỗi")
			.setColor("#FF0000")
			.setDescription("Có lỗi xảy ra khi truy xuất thông tin. Vui lòng thử lại!");
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}

	const targetUserName = targetUser.member?.displayName ?? targetUser.globalName ?? targetUser.username;
	const displayName = targetUser.id === interaction.user.id ? "bạn" : targetUserName;
	const possessive = targetUser.id === interaction.user.id ? "của bạn" : `của ${targetUserName}`;

	const embed = new EmbedBuilder()
		.setTitle(`${zigoldEmoji} ZiGold Balance`)
		.setColor("#FFD700")
		.setDescription(`**${displayName}** hiện tại có **${coin.toLocaleString()} ZiGold**!`)
		.addFields(
			{
				name: "💰 ZiGold",
				value: `${coin.toLocaleString()}`,
				inline: true,
			},
			{
				name: "📈 Level",
				value: `${level}`,
				inline: true,
			},
			{
				name: "✨ XP",
				value: `${xp}`,
				inline: true,
			},
		)
		.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `Kiếm thêm ZiGold bằng cách chơi các trò chơi và tương tác với bot!`,
			iconURL: interaction.client.user.displayAvatarURL(),
		});

	if (coin === 0) {
		embed.setDescription(
			`**${displayName}** chưa có ZiGold nào! Hãy bắt đầu chơi các trò chơi để kiếm ZiGold đầu tiên ${possessive}!`,
		);
	}

	await interaction.reply({ embeds: [embed] });
};
