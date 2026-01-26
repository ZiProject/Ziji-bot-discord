const fs = require("fs");
const path = require("path");
const { ApplicationCommandOptionType } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "dev-ban",
	description: "Cấm người dùng sử dụng bot",
	type: 1, // slash command
	options: [
		{
			name: "userid",
			description: "ID người dùng",
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	integration_types: [0],
	contexts: [0],
	owner: true,
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const config = useHooks.get("config");

	const userId = interaction.options.getString("userid");
	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id))
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	// Đọc file JSON
	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	}
	let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

	// Kiểm tra nếu user đã bị cấm
	if (devConfig.bannedUsers.includes(userId)) {
		return interaction.reply({ content: `Người dùng có ID ${userId} đã bị cấm trước đó!`, ephemeral: true });
	}

	// Thêm ID vào danh sách cấm
	devConfig.bannedUsers.push(userId);
	fs.writeFileSync(configPath, JSON.stringify(devConfig, null, 4));

	return interaction.reply({ content: `Đã cấm người dùng có ID ${userId} khỏi bot!`, ephemeral: true });
};
