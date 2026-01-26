const { useHooks } = require("zihooks");

module.exports.data = {
	name: "listservers",
	description: "List all servers the bot is in",
	type: 1,
	options: [],
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

	if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id))
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });

	await interaction.deferReply({ ephemeral: true });

	const servers = interaction.client.guilds.cache.map((guild) => ({
		name: guild.name,
		id: guild.id,
		memberCount: guild.memberCount,
	}));

	const embed = new EmbedBuilder()
		.setTitle("Servers List")
		.setColor("Blue")
		.setDescription(servers.map((server) => `**${server.name}** (ID: ${server.id}) - Members: ${server.memberCount}`).join("\n"))
		.setFooter({ text: `Total Servers: ${servers.length}` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
};
