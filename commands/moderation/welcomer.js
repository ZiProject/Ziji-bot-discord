const {
	PermissionsBitField,
	EmbedBuilder,
	MessageFlags,
	ContainerBuilder,
	ButtonBuilder,
	ButtonStyle,
	MediaGalleryItemBuilder,
} = require("discord.js");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const { readImageStudioAnimation } = require("../../utility/imageStudio");
const { sendGreeting, getMissingGreetingPermissions } = require("../../utility/sendGreeting");

const ANIMATION_STUDIO_URL = "https://image-studio-green.vercel.app/animation";
const ANIMATION_GUIDE_IMAGES = [
	"https://media.discordapp.net/attachments/1504721560156766305/1555999339451650118/image.png",
	"https://media.discordapp.net/attachments/1504721560156766305/1556000319295717437/image.png",
];

function parseGreetingConfig(rawConfig) {
	if (!rawConfig) return {};
	if (!rawConfig.startsWith("{")) return { description: rawConfig };
	return JSON.parse(rawConfig);
}

module.exports.data = {
	name: "welcomer",
	description: "Quản lý chào mừng / tạm biệt thanh viên",
	type: 1, // slash command
	options: [
		{
			name: "setup",
			description: "Setup chào mừng thành viên",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Kênh gửi lời chào mừng",
					type: 7,
					channel_types: [0],
					required: false,
				},
				{
					name: "content",
					description: "Nội dung chào mừng thành viên mới",
					type: 3,
					required: false,
				},
				{
					name: "byechannel",
					description: "Kênh gửi lời chào mừng",
					type: 7,
					channel_types: [0],
					required: false,
				},
				{
					name: "byecontent",
					description: "Nội dung chào mừng thành viên mới",
					type: 3,
					required: false,
				},
				{
					name: "animation",
					description: "Tải JSON animation GIF đã export từ Image Studio",
					type: 11,
					required: false,
				},
				{
					name: "byeanimation",
					description: "Tải JSON animation GIF tạm biệt từ Image Studio",
					type: 11,
					required: false,
				},
				{
					name: "title",
					description: "Tiêu đề embed chào mừng",
					type: 3,
					required: false,
				},
				{
					name: "footer",
					description: "Footer embed chào mừng",
					type: 3,
					required: false,
				},
				{
					name: "image",
					description: "Hình ảnh chào mừng (link ảnh hoặc 'default')",
					type: 3,
					required: false,
				},
				{
					name: "thumbnail",
					description: "Thumbnail chào mừng (link ảnh hoặc 'default')",
					type: 3,
					required: false,
				},
				{
					name: "byetitle",
					description: "Tiêu đề embed tạm biệt",
					type: 3,
					required: false,
				},
				{
					name: "byefooter",
					description: "Footer embed tạm biệt",
					type: 3,
					required: false,
				},
				{
					name: "byeimage",
					description: "Hình ảnh tạm biệt (link ảnh hoặc 'default')",
					type: 3,
					required: false,
				},
				{
					name: "byethumbnail",
					description: "Thumbnail tạm biệt (link ảnh hoặc 'default')",
					type: 3,
					required: false,
				},
			],
		},
		{
			name: "edit",
			description: "Cập nhật animation chào mừng hoặc tạm biệt",
			type: 1,
			options: [
				{
					name: "type",
					description: "Loại animation cần cập nhật",
					type: 3,
					required: true,
					choices: [
						{ name: "Chào mừng", value: "welcome" },
						{ name: "Tạm biệt", value: "goodbye" },
					],
				},
				{
					name: "animation",
					description: "Tải file JSON animation đã lưu từ Image Studio",
					type: 11,
					required: true,
				},
			],
		},
		{
			name: "preview",
			description: "Xem thử animation chào mừng hoặc tạm biệt",
			type: 1,
			options: [
				{
					name: "type",
					description: "Loại animation cần xem thử",
					type: 3,
					required: true,
					choices: [
						{ name: "Chào mừng", value: "welcome" },
						{ name: "Tạm biệt", value: "goodbye" },
					],
				},
			],
		},
		{
			name: "help",
			description: "Hướng dẫn tạo và lưu animation chào mừng",
			type: 1,
			options: [],
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0", // chỉ có admin mới dùng được
	enable: config?.DevConfig?.welcomer,
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
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
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}
	const db = useHooks.get("db");
	if (!db) return interaction.reply({ content: lang?.until?.noDB });
	const Welcome = useHooks.get("welcome");
	const commandtype = interaction.options?.getSubcommand();
	if (commandtype === "help") return this.showHelp(interaction);

	if (commandtype === "preview") {
		const type = interaction.options.getString("type");
		try {
			const sent = await sendGreeting(interaction.member, type, interaction.channel);
			return interaction.editReply({
				content:
					sent ?
						`✅ Đã gửi bản xem thử ${type === "welcome" ? "chào mừng" : "tạm biệt"} vào kênh này.`
					:	"❌ Chưa có cấu hình welcomer để xem thử. Hãy dùng `/welcomer setup` trước.",
			});
		} catch (error) {
			console.error("Error previewing welcomer animation:", error);
			return interaction.editReply({ content: `❌ Không thể tạo bản xem thử: ${error.message}` });
		}
	}

	if (commandtype === "edit") {
		const type = interaction.options.getString("type");
		const animation = interaction.options.getAttachment("animation");
		return this.editAnimation({ interaction, db, Welcome, type, animation });
	}

	const channel = interaction.options.getChannel("channel");
	const content = interaction.options.getString("content");
	const byechannel = interaction.options.getChannel("byechannel");
	const byecontent = interaction.options.getString("byecontent");
	const animation = interaction.options.getAttachment("animation");
	const byeanimation = interaction.options.getAttachment("byeanimation");

	const title = interaction.options.getString("title");
	const footer = interaction.options.getString("footer");
	const image = interaction.options.getString("image");
	const thumbnail = interaction.options.getString("thumbnail");

	const byetitle = interaction.options.getString("byetitle");
	const byefooter = interaction.options.getString("byefooter");
	const byeimage = interaction.options.getString("byeimage");
	const byethumbnail = interaction.options.getString("byethumbnail");

	switch (commandtype) {
		case "setup":
			return this.setupWelcome({
				interaction,
				lang,
				options: {
					channel,
					content,
					byechannel,
					byecontent,
					animation,
					byeanimation,
					title,
					footer,
					image,
					thumbnail,
					byetitle,
					byefooter,
					byeimage,
					byethumbnail,
					db,
					Welcome,
				},
			});
		default:
			return interaction.editReply({ content: lang?.until?.notHavePremission || "Không thể thực hiện thao tác này." });
	}
};

module.exports.showHelp = async (interaction) => {
	const container = new ContainerBuilder().setAccentColor([92, 134, 255]);

	container
		.addTextDisplayComponents((text) =>
			text.setContent(
				[
					"# Hướng dẫn tạo animation chào mừng",
					"Mở **Animation Studio**, tạo animation và tải file JSON về để bot sử dụng.",
					"",
					"**Bước 1:** Mở trang tạo animation và chọn mẫu hoặc bắt đầu thiết kế.",
					"**Bước 2:** Chỉnh sửa animation, dùng các biến `{userAVTurl}`, `{userName}`, `{guildName}` nếu cần, sau đó nhấn **API Payload** để tải JSON.",
					"**Bước 3:** Chạy `/welcomer edit`, chọn loại **Chào mừng** hoặc **Tạm biệt**, rồi tải file JSON vừa lưu lên tùy chọn `animation`.",
					"",
					"Dùng `/welcomer preview` để xem thử. Cấu hình kênh gửi bằng `/welcomer setup`.",
				].join("\n"),
			),
		)
		.addActionRowComponents((row) =>
			row.setComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(ANIMATION_STUDIO_URL).setLabel("Animation Studio")),
		)
		.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1))
		.addMediaGalleryComponents((gallery) =>
			gallery.addItems(
				new MediaGalleryItemBuilder().setURL(ANIMATION_GUIDE_IMAGES[0]),
				new MediaGalleryItemBuilder().setURL(ANIMATION_GUIDE_IMAGES[1]),
			),
		);

	return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
};

module.exports.editAnimation = async ({ interaction, db, Welcome, type, animation }) => {
	try {
		const parsedAnimation = await readImageStudioAnimation(animation);
		const existing = await db.ZiWelcome.findOne({ guildId: interaction.guild.id });
		const isWelcome = type === "welcome";
		const rawContent = isWelcome ? existing?.content : existing?.Bcontent;
		const greetingConfig = parseGreetingConfig(rawContent);
		greetingConfig.animation = parsedAnimation;

		const finalContent = isWelcome ? JSON.stringify(greetingConfig) : (existing?.content ?? JSON.stringify({}));
		const finalByeContent = isWelcome ? (existing?.Bcontent ?? JSON.stringify({})) : JSON.stringify(greetingConfig);
		const record = {
			channel: existing?.channel || null,
			content: finalContent,
			Bchannel: existing?.Bchannel || null,
			Bcontent: finalByeContent,
		};

		await db.ZiWelcome.updateOne({ guildId: interaction.guild.id }, { $set: record }, { upsert: true });
		Welcome.set(interaction.guild.id, [record]);

		return interaction.editReply({
			content: `✅ Đã cập nhật animation ${isWelcome ? "chào mừng" : "tạm biệt"}. Dùng \`/welcomer preview\` để xem thử.`,
		});
	} catch (error) {
		console.error("Error updating welcomer animation:", error);
		return interaction.editReply({ content: `❌ Không thể cập nhật animation: ${error.message}` });
	}
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.setupWelcome = async ({ interaction, lang, options }) => {
	await interaction.deferReply({ flags: "Ephemeral" });
	try {
		const existing = await options.db.ZiWelcome.findOne({ guildId: interaction.guild.id });
		const existingWelcomeConfig = parseGreetingConfig(existing?.content);
		const existingByeConfig = parseGreetingConfig(existing?.Bcontent);

		const welcomeConfig = {
			description: options.content !== null ? options.content : existingWelcomeConfig.description || null,
			title: options.title !== null ? options.title : existingWelcomeConfig.title || null,
			footer: options.footer !== null ? options.footer : existingWelcomeConfig.footer || null,
			image: options.image !== null ? options.image : existingWelcomeConfig.image || null,
			thumbnail: options.thumbnail !== null ? options.thumbnail : existingWelcomeConfig.thumbnail || null,
			animation: options.animation ? await readImageStudioAnimation(options.animation) : existingWelcomeConfig.animation || null,
		};

		const byeConfig = {
			description: options.byecontent !== null ? options.byecontent : existingByeConfig.description || null,
			title: options.byetitle !== null ? options.byetitle : existingByeConfig.title || null,
			footer: options.byefooter !== null ? options.byefooter : existingByeConfig.footer || null,
			image: options.byeimage !== null ? options.byeimage : existingByeConfig.image || null,
			thumbnail: options.byethumbnail !== null ? options.byethumbnail : existingByeConfig.thumbnail || null,
			animation:
				options.byeanimation ? await readImageStudioAnimation(options.byeanimation) : existingByeConfig.animation || null,
		};

		const finalChannel = options.channel?.id !== undefined ? options.channel?.id : existing?.channel || null;
		const finalByeChannel = options.byechannel?.id !== undefined ? options.byechannel?.id : existing?.Bchannel || null;

		for (const [type, channelId, selectedChannel] of [
			["chào mừng", finalChannel, options.channel],
			["tạm biệt", finalByeChannel, options.byechannel],
		]) {
			if (!channelId) continue;
			const channel = selectedChannel?.id === channelId ? selectedChannel : await interaction.guild.channels.fetch(channelId);
			const missingPermissions = await getMissingGreetingPermissions(channel, interaction.guild);
			if (missingPermissions.length) {
				return interaction.editReply({
					content: `❌ Bot thiếu quyền **${missingPermissions.join(", ")}** trong kênh <#${channelId}> (${type}). Cấp quyền rồi thử lại; cấu hình chưa được lưu.`,
				});
			}
		}

		const finalContentStr = JSON.stringify(welcomeConfig);
		const finalByeContentStr = JSON.stringify(byeConfig);

		await options.db.ZiWelcome.updateOne(
			{ guildId: interaction.guild.id },
			{
				$set: {
					channel: finalChannel,
					content: finalContentStr,
					Bchannel: finalByeChannel,
					Bcontent: finalByeContentStr,
				},
			},
			{ upsert: true },
		);

		options.Welcome.set(interaction.guild.id, [
			{
				channel: finalChannel,
				content: finalContentStr,
				Bchannel: finalByeChannel,
				Bcontent: finalByeContentStr,
			},
		]);

		const sucessEm = new EmbedBuilder()
			.setTitle(`Sucess`)
			.setDescription(`Welcome & Goodbye system has been setup in ${interaction.guild.name}`)
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) })
			.setColor("Green")
			.setTimestamp()
			.setThumbnail(interaction.user.displayAvatarURL());
		await interaction.editReply({ embeds: [sucessEm] });
		interaction.client.emit("guildMemberAdd", interaction.member);
		interaction.client.emit("guildMemberRemove", interaction.member);

		return;
	} catch (error) {
		console.error(error);
		interaction.editReply(`Đã xảy ra lỗi khi thêm Welcome: ${error.message}`);
	}
	return;
};
