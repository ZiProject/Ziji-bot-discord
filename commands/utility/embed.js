const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "embed",
	description: "Create rich embed message",
	options: [
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
			name: "channel",
			description: "Channel gửi embed",
			type: 7, // CHANNEL
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
	],
	type: 1,
	alias: ["em"],
	category: "utils",
	enable: true,
};

function getFlag(args, name) {
	const index = args.indexOf(`--${name}`);
	if (index === -1) return null;
	const value = args[index + 1];
	args.splice(index, 2);
	return value ?? null;
}

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

function buildEmbed({ color, text, title, image, thumb, author, user }) {
	const embed = new EmbedBuilder()
		.setColor(color)
		.setDescription(text)
		.setTimestamp()
		.setFooter({
			text: `Requested by ${user.tag}`,
			iconURL: user.displayAvatarURL(),
		});

	if (title) embed.setTitle(title);
	if (image) embed.setImage(image);
	if (thumb) embed.setThumbnail(thumb);
	if (author) embed.setAuthor({ name: author });

	return embed;
}

/**
 * @param { object } command - interaction command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction }) => {
	const channel = interaction.options.getChannel("channel") || interaction.channel;

	const rawColor = interaction.options.getString("color");
	const text = interaction.options.getString("text");
	const title = interaction.options.getString("title");
	const image = interaction.options.getString("image");
	const thumb = interaction.options.getString("thumb");
	const author = interaction.options.getString("author");

	const color = resolveColor(rawColor);
	if (!color)
		return interaction.reply({
			content: "❌ Màu không hợp lệ (vd: red, blue, #ff0000)",
			ephemeral: true,
		});

	const embed = buildEmbed({
		color,
		text,
		title,
		image,
		thumb,
		author,
		user: interaction.user,
	});

	await channel.send({ embeds: [embed] });

	return interaction.reply({
		content: `✅ Đã gửi embed vào ${channel}`,
		ephemeral: true,
	});
};

/**
 * @param { object } command - message command
 * @param { import ("zihooks").CommandInteraction } command.message - message
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.run = async ({ message, args }) => {
	const config = useHooks.get("config");
	const flag = config.prefix || "z!";
	if (!args.length) {
		const demo = new EmbedBuilder()
			.setColor("#00ffff")
			.setTitle("✨ Embed Command Demo")
			.setDescription(
				"**Cách dùng:**\n" +
					flag +
					"`embed --channel <channel ID> --color <color> <text>`\n\n" +
					"**Ví dụ:**\n" +
					flag +
					"`embed --color red Xin chào Discord`\n" +
					flag +
					"`em --channel 1007597271392727051 --color blue Hello world`\n\n" +
					"**Nâng cao:**\n" +
					"`--title`, `--image`, `--thumb`, `--author`",
			)
			.setThumbnail(message.author.displayAvatarURL())
			.setFooter({ text: "Tip: dùng màu hex hoặc tên màu 😉" });

		return message.reply({ embeds: [demo] });
	}

	const title = getFlag(args, "title");
	const image = getFlag(args, "image");
	const thumb = getFlag(args, "thumb");
	const author = getFlag(args, "author");
	const rawColor = getFlag(args, "color") || args.shift();
	const rawChannel = getFlag(args, "channel");
	const channel = message.guild.channels.cache.get(rawChannel) || message.channel;

	if (!rawColor) return message.reply("❌ Thiếu màu embed");

	const color = COLOR_MAP[rawColor.toLowerCase()] || (rawColor.startsWith("#") ? rawColor.toLowerCase() : null);

	if (!color) return message.reply("❌ Màu không hợp lệ");

	const text = args.join(" ");
	if (!text) return message.reply("❌ Thiếu nội dung embed");

	const embed = new EmbedBuilder()
		.setColor(`${color}`)
		.setDescription(text)
		.setTimestamp()
		.setFooter({
			text: `Requested by ${message.author.tag}`,
			iconURL: message.author.displayAvatarURL(),
		});

	if (title) embed.setTitle(title);
	if (image) embed.setImage(image);
	if (thumb) embed.setThumbnail(thumb);
	if (author) embed.setAuthor({ name: author });

	await channel.send({ embeds: [embed] });

	if (channel.id !== message.channel.id) message.reply(`✅ Đã gửi embed vào ${channel}`);
};
