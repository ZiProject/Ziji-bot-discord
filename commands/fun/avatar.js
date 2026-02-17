const { AttachmentBuilder } = require("discord.js");
const fs = require("fs");
module.exports.data = {
	name: "avatar",
	description: "Xem ảnh đại diện của ai đó",
	type: 1, // slash command
	options: [
		{
			name: "user",
			description: "Chọn người dùng để xem avatar",
			type: 6,
			required: false,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
	alias: ["avt"],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const user = interaction.options.getUser("user") || interaction.user;
	const url = user.displayAvatarURL({ size: 1024 });
	interaction.reply({ files: [url] });
	return;
};

/**
 * @param { object } command - message command
 * @param { import ("zihooks").CommandInteraction } command.message - message
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.run = async ({ message, args, lang }) => {
	const user = message.mentions.users.first() || message.author;
	const url = user.displayAvatarURL({ size: 1024 });
	message.reply({ files: [url] });
	return;
};
