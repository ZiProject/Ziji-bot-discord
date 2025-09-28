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

module.exports.data = {
	name: "language",
	description: "Chỉnh sửa ngôn ngữ bot",
	type: 1, // slash commad
	options: [
		{
			name: "lang",
			description: "Chọn ngôn ngữ",
			type: 3, // string
			required: true,
			choices: [
				{ name: "Tiếng Việt", value: "vi" },
				{ name: "English", value: "en" },
			],
		},
	],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	const langcode = interaction.options.getString("lang");
	const DataBase = this.db;
	if (!DataBase)
		return interaction.editReply({
			content: lang?.until?.noDB || "Database hiện không được bật, xin vui lòng liên hệ dev bot",
		});
	await DataBase.ZiUser.updateOne(
		{ userID: interaction.user.id },
		{
			$set: {
				lang: langcode,
			},
		},
		{ upsert: true },
	);
	const langfunc = this.functions?.get("ZiRank");
	const lang2 = await langfunc.execute({ user: interaction.user, XpADD: 0 });
	interaction.editReply({ content: `${lang2.until.langChange} ${lang2.until.name}` });
};
