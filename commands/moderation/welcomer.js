const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const parseVar = useHooks.get("functions").get("getVariable");
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
		// {
		// 	name: "edit",
		// 	description: "Setup tạm biệt thành viên",
		// 	type: 1,
		// 	options: [
		// 		{
		// 			name: "channel",
		// 			description: "Kênh gửi lời chào mừng",
		// 			type: 7,
		// 			channel_types: [0],
		// 			required: false,
		// 		},
		// 		{
		// 			name: "content",
		// 			description: "Nội dung chào mừng thành viên mới",
		// 			type: 3,
		// 			required: false,
		// 		},
		// 		{
		// 			name: "byechannel",
		// 			description: "Kênh gửi lời chào mừng",
		// 			type: 7,
		// 			channel_types: [0],
		// 			required: false,
		// 		},
		// 		{
		// 			name: "byecontent",
		// 			description: "Nội dung chào mừng thành viên mới",
		// 			type: 3,
		// 			required: false,
		// 		},
		// 	],
		// },
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
	const channel = interaction.options.getChannel("channel");
	const content = interaction.options.getString("content");
	const byechannel = interaction.options.getChannel("byechannel");
	const byecontent = interaction.options.getString("byecontent");

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
			return interaction.reply({ content: lang?.until?.notHavePremission, ephemeral: true });
	}
	return;
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
		let existingWelcomeConfig = {};
		let existingByeConfig = {};

		if (existing) {
			if (existing.content && existing.content.startsWith("{")) {
				try {
					existingWelcomeConfig = JSON.parse(existing.content);
				} catch (e) {}
			} else if (existing.content) {
				existingWelcomeConfig = { description: existing.content };
			}

			if (existing.Bcontent && existing.Bcontent.startsWith("{")) {
				try {
					existingByeConfig = JSON.parse(existing.Bcontent);
				} catch (e) {}
			} else if (existing.Bcontent) {
				existingByeConfig = { description: existing.Bcontent };
			}
		}

		const welcomeConfig = {
			description: options.content !== null ? options.content : existingWelcomeConfig.description || null,
			title: options.title !== null ? options.title : existingWelcomeConfig.title || null,
			footer: options.footer !== null ? options.footer : existingWelcomeConfig.footer || null,
			image: options.image !== null ? options.image : existingWelcomeConfig.image || null,
			thumbnail: options.thumbnail !== null ? options.thumbnail : existingWelcomeConfig.thumbnail || null,
		};

		const byeConfig = {
			description: options.byecontent !== null ? options.byecontent : existingByeConfig.description || null,
			title: options.byetitle !== null ? options.byetitle : existingByeConfig.title || null,
			footer: options.byefooter !== null ? options.byefooter : existingByeConfig.footer || null,
			image: options.byeimage !== null ? options.byeimage : existingByeConfig.image || null,
			thumbnail: options.byethumbnail !== null ? options.byethumbnail : existingByeConfig.thumbnail || null,
		};

		const finalChannel = options.channel?.id !== undefined ? options.channel?.id : existing?.channel || null;
		const finalByeChannel = options.byechannel?.id !== undefined ? options.byechannel?.id : existing?.Bchannel || null;

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
		interaction.editReply("Đã xảy ra lỗi khi thêm Welcome.");
	}
	return;
};
