const { PermissionsBitField } = require("discord.js");
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
				await DataBase.ZiGuild.findOneAndUpdate(
					{ guildId }, // Query condition
					{
						joinToCreate: {
							enabled: true,
							voiceChannelId: channel.id,
							categoryId: category.id,
						},
					},
					{ new: true, upsert: true },
				);

				await interaction.followUp({
					content: `Join-to-create has been successfully set up!\n**Voice Channel:** ${channel.name}\n**Category:** ${category.name}`,
					ephemeral: true,
				});
				break;
			}
			case "disable": {
				const guildId = interaction.guild.id;

				// Disable the join-to-create system
				const updatedGuild = await DataBase.ZiGuild.findOneAndUpdate(
					{ guildId }, // Query condition
					{ "joinToCreate.enabled": false },
					{ new: true },
				);

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
