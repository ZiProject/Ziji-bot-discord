const { PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "ban",
	description: "Cấm một người dùng khỏi máy chủ",
	type: 1, // slash command
	options: [
		{
			name: "user",
			description: "Người dùng cần cấm",
			type: 6, // user
			required: true,
		},
		{
			name: "reason",
			description: "Lý do cấm",
			type: 3, // string
			required: false,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const user = interaction.options.getUser("user");
	const reason = interaction.options.getString("reason") || "Không có lý do";

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers) && user.id !== interaction.client.user.id) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	if (user.id === interaction.user.id) {
		return interaction.reply({ content: "Bạn không thể tự cấm chính mình.", ephemeral: true });
	}

	const member = interaction.guild.members.cache.get(user.id);
	if (!member) {
		return interaction.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
	}

	if (member.roles.highest.position >= interaction.member.roles.highest.position) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	try {
		await user.send(`Bạn đã bị cấm khỏi ${interaction.guild.name} vì: ${reason}`);
	} catch (error) {
		console.error(`Không thể gửi tin nhắn trực tiếp cho ${user.tag}:`, error);
	}

	await member.ban({ reason });
	interaction.reply({ content: `Đã cấm ${user.tag} vì: ${reason}` });
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").Message } command.message - message
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.run = async ({ message, args, lang }) => {
	const userId = args[0];
	const reason = args.slice(1).join(" ") || "Không có lý do";

	if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers) && userId !== message.client.user.id) {
		return message.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
		return message.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	if (userId === message.author.id) {
		return message.reply({ content: "Bạn không thể tự cấm chính mình.", ephemeral: true });
	}

	const member = message.guild.members.cache.get(userId);
	if (!member) {
		return message.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
	}

	if (member.roles.highest.position >= message.member.roles.highest.position) {
		return message.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	try {
		await member.user.send(`Bạn đã bị cấm khỏi ${message.guild.name} vì: ${reason}`);
	} catch (error) {
		console.error(`Không thể gửi tin nhắn trực tiếp cho ${member.user.tag}:`, error);
	}

	await member.ban({ reason });
	message.reply({ content: `Đã cấm ${member.user.tag} vì: ${reason}` });
};
