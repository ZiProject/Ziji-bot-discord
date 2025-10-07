const config = require("@zibot/zihooks").useHooks.get("config");

module.exports.data = {
	name: "leaveserver",
	description: "Leave a server by ID",
	type: 1,
	options: [
		{
			name: "server_id",
			description: "The ID of the server to leave",
			type: 3, // STRING
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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id))
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });

	const serverId = interaction.options.getString("server_id");
	const guild = interaction.client.guilds.cache.get(serverId);

	if (!guild) {
		return interaction.reply({ content: "Server not found.", ephemeral: true });
	}

	try {
		await guild.leave();
		await interaction.reply({
			content: `Successfully left the server: ${guild.name}`,
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error leaving server:", error);
		await interaction.reply({
			content: "An error occurred while trying to leave the server.",
			ephemeral: true,
		});
	}
};
