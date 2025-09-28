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

const fs = require("fs");
const path = require("path");
const { ApplicationCommandOptionType } = require("discord.js");
// Config will be available through this.config in bound context
module.exports.data = {
	name: "dev-unban",
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
	const userId = interaction.options.getString("userid");
	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id))
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	}
	let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

	// Kiểm tra nếu user chưa bị cấm
	if (!devConfig.bannedUsers.includes(userId)) {
		return interaction.reply({ content: `Người dùng có ID ${userId} không nằm trong danh sách cấm.`, ephemeral: true });
	}

	// Xóa ID khỏi danh sách cấm
	devConfig.bannedUsers = config.bannedUsers.filter((id) => id !== userId);
	fs.writeFileSync(configPath, JSON.stringify(devConfig, null, 4));

	return interaction.reply({ content: `Đã gỡ cấm người dùng có ID ${userId}.`, ephemeral: true });
};
