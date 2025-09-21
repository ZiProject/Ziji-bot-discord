const { useFunctions, useConfig, useDB } = require("@zibot/zihooks");
const config = useConfig();
const { PermissionsBitField } = require("discord.js");

module.exports.data = {
	name: "voice",
	description: "Thiết lập lệnh voice",
	type: 1, // slash commmand
	options: [
		{
			name: "join",
			description: "Tham gia kênh voice",
			type: 1, // sub command
			options: [],
		},
		{
			name: "log",
			description: "Thông báo người tham gia kênh thoại",
			type: 1,
			options: [
				{
					name: "enabled",
					description: "Tùy chọn tắt/mở",
					type: 5, //bool
					required: true,
				},
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
	const commandtype = interaction.options?.getSubcommand();

	if (commandtype === "join") {
		const command = useFunctions().get("Search");
		await command.execute(interaction, null, lang, { joinvoice: true });
		return;
	} else if (commandtype === "log") {
		if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
			return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
		}
		const toggle = interaction.options.getBoolean("enabled");
		const guildId = interaction.guild.id;

		const DataBase = useDB();
		if (!DataBase)
			return interaction.editReply({
				content: lang?.until?.noDB || "Database hiện không được bật, xin vui lòng liên hệ dev bot",
			});

		let GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
		if (!GuildSetting) {
			GuildSetting = new DataBase.ZiGuild({ guildId });
		}

		GuildSetting.voice.logMode = toggle;
		await GuildSetting.save();

		await interaction.reply({
			content: `Voice log has been ${toggle ? "enabled" : "disabled"}.`,
			ephemeral: true,
		});
	}
	return;
};
