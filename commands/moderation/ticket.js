/**
 * Run when Called
 * await useHooks.get("commands").get("ticket").execute(args)
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "ticket",
	description: "Tạo panel mở ticket",
	type: 1,

	options: [
		{
			name: "description",
			description: "Mô tả hiển thị trong embed",
			type: 3, // STRING
			required: false,
		},
	],

	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
	category: "system",
	enable: true,
	alias: [],
};

/**
 * SLASH COMMAND
 */
module.exports.execute = async ({ interaction, lang }) => {
	const description = interaction.options.getString("description") || "Nhấn nút bên dưới để mở ticket";
	const embed = new EmbedBuilder().setTitle("🎫 HỖ TRỢ").setDescription(description).setColor("Green");

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("ticket:create").setLabel("Mở Ticket").setStyle(ButtonStyle.Primary),
	);

	return interaction.reply({
		embeds: [embed],
		components: [row],
	});
};

/**
 * MESSAGE COMMAND
 */
module.exports.run = async ({ message, args, lang }) => {
	const description = args.join(" ") || "Nhấn nút bên dưới để mở ticket";
	const embed = new EmbedBuilder().setTitle("🎫 HỖ TRỢ").setDescription(description).setColor("Green");
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("ticket:create").setLabel("Mở Ticket").setStyle(ButtonStyle.Primary),
	);

	return message.reply({
		embeds: [embed],
		components: [row],
	});
};
