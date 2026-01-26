const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const { PermissionsBitField } = require("discord.js");
const { getPlayer } = require("ziplayer");

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
		{ name: "leave", description: "Rời kênh voice", type: 1, options: [] },
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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const commandtype = interaction.options?.getSubcommand();

	if (commandtype === "join") {
		const command = useHooks.get("functions").get("Search");
		await command.execute(interaction, null, lang, { assistant: true });
		return;
	} else if (commandtype === "leave") {
		const player = getPlayer(interaction.guild.id);
		await interaction.deferReply({ withResponse: true });
		if (!player?.connection) {
			await interaction?.guild?.members?.me?.voice?.disconnect();
			await interaction.editReply(lang.music.Disconnect);
			return;
		}
		if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id) return;
		await player.userdata?.mess?.edit({ components: [] }).catch((e) => {});
		player?.destroy();
		await interaction.editReply(lang.music.DisconnectDes);
		return;
	} else if (commandtype === "log") {
		if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
			return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
		}
		const toggle = interaction.options.getBoolean("enabled");
		const guildId = interaction.guild.id;

		const DataBase = useHooks.get("db");
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
