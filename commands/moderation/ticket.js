/**
 * Run when Called
 * await useHooks.get("commands").get("ticket").execute(args)
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const { useHooks } = require("zihooks");
const COLOR_MAP = {
	red: "#ff0000",
	blue: "#0099ff",
	green: "#00ff99",
	yellow: "#ffcc00",
	purple: "#9b59b6",
	black: "#000000",
	white: "#ffffff",
};

function resolveColor(input) {
	return COLOR_MAP[input?.toLowerCase()] || (input?.startsWith("#") ? input : null);
}

module.exports.data = {
	name: "ticket",
	description: "Tạo panel mở ticket",
	type: 1,
	options: [
		{
			name: "category",
			description: "Category chứa các ticket",
			type: 7, // CHANNEL
			channel_types: [4], // CATEGORY
			required: true,
		},
		{
			name: "logchannel",
			description: "Kênh lưu log ticket",
			type: 7, // CHANNEL
			channel_types: [0], // GUILD_TEXT
			required: true,
		},
		{
			name: "color",
			description: "Màu embed (red, blue, #ff0000)",
			type: 3, // STRING
			required: true,
		},
		{
			name: "text",
			description: "Nội dung embed",
			type: 3, // STRING
			required: true,
		},
		{
			name: "staffrole",
			description: "Role staff có thể xem ticket",
			type: 8, // ROLE
			required: false,
		},
		{
			name: "title",
			description: "Tiêu đề embed",
			type: 3,
			required: false,
		},
		{
			name: "image",
			description: "Link ảnh embed",
			type: 3,
			required: false,
		},
		{
			name: "thumb",
			description: "Thumbnail embed",
			type: 3,
			required: false,
		},
		{
			name: "author",
			description: "Author embed",
			type: 3,
			required: false,
		},
		{
			name: "channel",
			description: "Kênh để bot gửi panel (mặc định là kênh hiện tại)",
			type: 7, // CHANNEL
			channel_types: [0], // GUILD_TEXT
			required: false,
		},
		{
			name: "allowuserclose",
			description: "Cho phép người tạo ticket tự đóng (mặc định: có)",
			type: 5, // BOOLEAN
			required: false,
		}
	],

	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
	category: "system",
	enable: useHooks.get("config").DevConfig.ticket ? true : false,
	Moptions: [
		{
			name: "color",
			type: "string",
			description: "Màu embed (red, blue, #ff0000)",
		},
		{
			name: "title",
			type: "string",
			description: "Tiêu đề embed",
		},
		{
			name: "image",
			type: "string",
			description: "Link ảnh embed",
		},
		{
			name: "thumb",
			type: "string",
			description: "Thumbnail embed",
		},
		{
			name: "author",
			type: "string",
			description: "Author embed",
		},
	],
};

/**
 * SLASH COMMAND
 */
module.exports.execute = async ({ interaction, lang }) => {
	const rawColor = interaction.options.getString("color");
	const text = interaction.options.getString("text");
	const title = interaction.options.getString("title");
	const image = interaction.options.getString("image");
	const thumb = interaction.options.getString("thumb");
	const author = interaction.options.getString("author");
	const staffRole = interaction.options.getRole("staffrole") || null;
	const logChannel = interaction.options.getChannel("logchannel");
	const category = interaction.options.getChannel("category");
	const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
	const allowUserClose = interaction.options.getBoolean("allowuserclose") ?? true;
	const color = resolveColor(rawColor);
	if (!color)
		return interaction.reply({
			content: "❌ Màu không hợp lệ (vd: red, blue, #ff0000)",
			ephemeral: true,
		});

	const embed = new EmbedBuilder().setColor(color).setDescription(text).setTimestamp();

	if (title) embed.setTitle(title);
	if (image) embed.setImage(image);
	if (thumb) embed.setThumbnail(thumb);
	if (author) embed.setAuthor({ name: author });
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_ticket_create").setLabel("Mở Ticket").setStyle(ButtonStyle.Primary),
	);
	const DataBase = useHooks.get("db");
	let GuildSetting = await DataBase.ZiGuild.findOne({ guildId: interaction.guild.id });
	if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId: interaction.guild.id });
	if (!GuildSetting.ticket) GuildSetting.ticket = {};
	GuildSetting.ticket.categoryId = category.id;
	GuildSetting.ticket.staffRoleId = staffRole ? staffRole.id : null;
	GuildSetting.ticket.logChannelId = logChannel ? logChannel.id : null;
	GuildSetting.ticket.allowUserClose = allowUserClose;
	if (typeof GuildSetting.markModified === "function") GuildSetting.markModified("ticket");
	await GuildSetting.save();
	return interaction.reply({
		content: "✅ Panel ticket đã được tạo!",
		flags: MessageFlags.Ephemeral,
		embeds: [embed],
		components: [row],
	}).then(() => {
		targetChannel.send({ embeds: [embed], components: [row] });
	});
};

/**
 * MESSAGE COMMAND
 */
module.exports.run = async ({ message, args, lang }) => {
	const config = useHooks.get("config");
	const flag = config.prefix || "z!";
	const title = message.getFlag("title");
	const image = message.getFlag("image");
	const thumb = message.getFlag("thumb");
	const author = message.getFlag("author");
	const rawColor = message.getFlag("color") || args.shift();
	const color = COLOR_MAP[rawColor.toLowerCase()] || (rawColor.startsWith("#") ? rawColor.toLowerCase() : null);
	const text = args.join(" ");

	const embed = new EmbedBuilder()
		.setColor(`${color ?? "Random"}`)
		.setDescription(text ?? "Nhấn nút bên dưới để mở ticket")
		.setTimestamp();

	if (title) embed.setTitle(title);
	if (image) embed.setImage(image);
	if (thumb) embed.setThumbnail(thumb);
	if (author) embed.setAuthor({ name: author });

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_ticket_create").setLabel("Mở Ticket").setStyle(ButtonStyle.Primary),
	);

	return message.reply({
		embeds: [embed],
		components: [row],
	});
};
