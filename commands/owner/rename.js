const { useHooks } = require("zihooks");

module.exports.data = {
	name: "rename",
	description: "Rename bot by sever ID",
	type: 1,
	options: [
		{
			name: "server_id",
			description: "The ID of the server to rename",
			type: 3, // STRING
			required: true,
		},
		{
			name: "name",
			description: "The name of bot",
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
	const config = useHooks.get("config");

	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id))
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });

	const serverId = interaction.options.getString("server_id");
	const name = interaction.options.getString("name");

	const guild = interaction.client.guilds.cache.get(serverId);

	if (!guild) {
		return interaction.reply({ content: "Server not found.", ephemeral: true });
	}

	try {
		const botMEMBER = guild.members.cache.get(interaction.client.user.id); //(name);
		botMEMBER.setNickname(name);
		await interaction.reply({
			content: `Successfully rename of bot in server: ${guild.name}`,
			ephemeral: true,
		});
	} catch (error) {
		console.error("Error rename bot:", error);
		await interaction.reply({
			content: "An error occurred while trying to rename bot in the server.",
			ephemeral: true,
		});
	}
};
