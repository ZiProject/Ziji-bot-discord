const { PermissionsBitField, Guild } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "join-to-create",
	description: "Join-to-create manager",
	type: 1, // slash commmand
	options: [
		{
			name: "setup",
			description: "Setup the temporary voice system on this server",
			type: 1, // sub command
			options: [
				{
					name: "channel",
					description: "Join-to-create channel",
					required: true,
					type: 7,
					//https://discord.com/developers/docs/resources/channel#channel-object-channel-types
					channel_types: [2],
				},
				{
					name: "category",
					description: "The category that the temporary channels should be in",
					required: true,
					type: 7,
					channel_types: [4],
				},
			],
		},
		{
			name: "disable",
			description: "Turn off the join-to-create system",
			type: 1, // sub command
			options: [],
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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	await interaction.deferReply({ ephemeral: true });
	const DataBase = useHooks.get("db");
	if (!DataBase)
		return interaction.editReply({
			content: lang?.until?.noDB || "Database hiện không được bật, xin vui lòng liên hệ dev bot",
		});

	const command = interaction.options.getSubcommand();
	try {
		switch (command) {
			case "setup": {
				if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
					return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
				}

				if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
					return interaction.reply({
						content: lang.until.botNOPermission.replace("{Permission}", "Manage Channels"),
						ephemeral: true,
					});
				}

				const channel = interaction.options.getChannel("channel");
				const category = interaction.options.getChannel("category");
				const guildId = interaction.guild.id;
				let GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
				if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId });
				if (!GuildSetting.joinToCreate) GuildSetting.joinToCreate = {};
				GuildSetting.joinToCreate.enabled = true;
				GuildSetting.joinToCreate.voiceChannelId = channel.id;
				GuildSetting.joinToCreate.categoryId = category.id;
				if (typeof GuildSetting.markModified === "function") GuildSetting.markModified("joinToCreate");
				await GuildSetting.save();
				const guildSettings = useHooks.get("guildSettings");
				const joinToCreateCache = useHooks.get("joinToCreateCache");
				//console.log(joinToCreateCache);
				const data = {
					enabled: true,
					voiceChannelId: channel.id,
					categoryId: category.id,
				};

				if (guildSettings?.has(guildId)) {
					guildSettings.get(guildId).joinToCreate = data;
				}

				joinToCreateCache?.set(channel.id, {
					guildId,
					...data,
				});
				await interaction.followUp({
					content: `Join-to-create has been successfully set up!\n**Voice Channel:** ${channel.name}\n**Category:** ${category.name}`,
					ephemeral: true,
				});
				break;
			}
			case "disable": {
				const guildId = interaction.guild.id;

				// Disable the join-to-create system
				let GuildSetting = await DataBase.ZiGuild.findOne({ guildId });
				if (!GuildSetting) GuildSetting = new DataBase.ZiGuild({ guildId });
				if (!GuildSetting.joinToCreate) GuildSetting.joinToCreate = {};
				GuildSetting.joinToCreate.enabled = false;
				if (typeof GuildSetting.markModified === "function") GuildSetting.markModified("joinToCreate");
				await GuildSetting.save();
				const guildSettings = useHooks.get("guildSettings");

				const joinToCreateCache = useHooks.get("joinToCreateCache");

				const oldData = guildSettings?.get(guildId)?.joinToCreate;

				if (oldData?.voiceChannelId) {
					joinToCreateCache?.delete(oldData.voiceChannelId);
				}

				if (guildSettings?.has(guildId)) {
					guildSettings.get(guildId).joinToCreate.enabled = false;
				}

				if (updatedGuild) {
					await interaction.followUp({
						content: `Join-to-create has been disabled.`,
						ephemeral: true,
					});
				} else {
					await interaction.followUp({
						content: `Join-to-create system was not set up.`,
						ephemeral: true,
					});
				}
				break;
			}
			default: {
				await interaction.followUp({
					content: `Unknown subcommand.`,
					ephemeral: true,
				});
				break;
			}
		}
	} catch (error) {
		console.error(error);
		await interaction.followUp({
			content: `An error occurred: ${error.message}`,
			ephemeral: true,
		});
	}
};
