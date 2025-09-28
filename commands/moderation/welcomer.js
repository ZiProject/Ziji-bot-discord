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

const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const config = this.config;
const parseVar = this.functions?.get("getVariable");
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
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}
	const db = this.db;
	if (!db) return interaction.reply({ content: lang?.until?.noDB });
	const Welcome = this.welcome;
	const commandtype = interaction.options?.getSubcommand();
	const channel = interaction.options.getChannel("channel");
	const content = interaction.options.getString("content");
	const byechannel = interaction.options.getChannel("byechannel");
	const byecontent = interaction.options.getString("byecontent");

	switch (commandtype) {
		case "setup":
			return this.setupWelcome({ interaction, lang, options: { channel, content, byechannel, byecontent, db, Welcome } });
		case "goodbye":
			return this.editGoodbye({ interaction, lang, options: { channel, content, byechannel, byecontent, db, Welcome } });
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
		await options.db.ZiWelcome.updateOne(
			{ guildId: interaction.guild.id },
			{
				$set: {
					channel: options.channel?.id,
					content: options.content,
					Bchannel: options.byechannel?.id,
					Bcontent: options.byecontent,
				},
			},
			{ upsert: true },
		);
		// }

		if (!options.Welcome.has(interaction.guild.id)) {
			options.Welcome.set(interaction.guild.id, []);
		}

		options.Welcome.get(interaction.guild.id).push({
			channel: options.channel?.id,
			content: options.content,
			Bchannel: options.byechannel?.id,
			Bcontent: options.byecontent,
		});
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
