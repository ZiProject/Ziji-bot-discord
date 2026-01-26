const { PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "warn",
	description: "Cảnh cáo một người dùng",
	type: 1, // slash command
	options: [
		{
			name: "user",
			description: "Người dùng cần cảnh cáo",
			type: 6, // user
			required: true,
		},
		{
			name: "reason",
			description: "Lý do cảnh cáo",
			type: 3, // string
			required: true,
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

	if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && user.id !== interaction.client.user.id) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	const member = interaction.guild.members.cache.get(user.id);
	if (!member) {
		return interaction.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
	}

	if (member.roles.highest.position >= interaction.member.roles.highest.position) {
		return interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
	}

	try {
		await user.send(`Bạn nhận được cảnh cáo từ ${interaction.guild.name} vì: ${reason}`);
	} catch (error) {
		console.error(`Không thể gửi tin nhắn trực tiếp cho ${user.tag}:`, error);
		interaction.reply({
			content: `Không thể gửi tin nhắn trực tiếp cho ${user.tag}, nhưng cảnh cáo vẫn được ghi nhận.`,
			ephemeral: true,
		});
		return;
	}
	interaction.reply({ content: `Đã cảnh cáo ${user.tag} vì: ${reason}` });
};

/**
 * @param { object } command - object command
 * @param { import ("zihooks").CommandInteraction } command.message - message
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.run = async ({ message, args, lang }) => {
	const users = message.getUserId();
	const reason = message.getText() || "Không có lý do";

	async function mentions(userId) {
		if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && userId !== message.client.user.id) {
			return message.reply({ content: lang.until.noPermission, ephemeral: true });
		}

		const member = message.guild.members.cache.get(userId);
		if (!member) {
			return message.reply({ content: "Không tìm thấy người dùng.", ephemeral: true });
		}

		if (member.roles.highest.position >= message.member.roles.highest.position) {
			return message.reply({ content: lang.until.notHavePremission, ephemeral: true });
		}

		try {
			await member.user.send(`Bạn nhận được cảnh cáo từ ${message.guild.name} vì: ${reason}`);
		} catch (error) {
			console.error(`Không thể gửi tin nhắn trực tiếp cho ${member.user.tag}:`, error);
		}

		message.reply({ content: `Đã cảnh cáo ${member.user.tag} vì: ${reason}` });
	}
	for (let userId of users) {
		await mentions(userId);
	}
};
