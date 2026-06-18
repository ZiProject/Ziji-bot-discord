const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "afk",
	description: "Thiết lập trạng thái vắng mặt của bạn",
	type: 1, // Slash command
	options: [
		{
			name: "reason",
			description: "Lý do bạn vắng mặt",
			type: 3, // String
			required: false,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

module.exports.execute = async ({ interaction, lang }) => {
	const db = useHooks.get("db");
	const reason = interaction.options.getString("reason") || "Không có lý do";

	await db.ZiUser.updateOne(
		{ userID: interaction.user.id },
		{
			$set: {
				afk: true,
				afkReason: reason,
				afkTime: new Date(),
			},
		},
		{ upsert: true },
	);

	const embed = new EmbedBuilder()
		.setColor("Yellow")
		.setDescription(`💤 **${interaction.user.username}** hiện đã ở trạng thái AFK.\n**Lý do:** ${reason}`)
		.setTimestamp();

	await interaction.reply({ embeds: [embed] });
};
