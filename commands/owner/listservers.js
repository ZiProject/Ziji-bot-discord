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

// Config will be available through this.config in bound context

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
