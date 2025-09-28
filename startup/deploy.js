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

const { REST, Routes } = require("discord.js");
const config = this.config;

module.exports = async (client) => {
	const commands = { global: [], owner: [] };

	// Load commands
	await Promise.all(
		this.commands.map(async (command) => {
			/**
			 * useCommands đã xử lý các commands disable ở index.js file rồi.
			 *  -> Nên không cần thiết xử lý lại ở đây
			 */
			commands[command.data.owner ? "owner" : "global"].push(command.data);
		}),
	).catch((e) => this.logger.info(`Error reloaded commands:\n ${e}`));

	const rest = new REST().setToken(process.env.TOKEN);

	const deployCommands = async (commandType, route) => {
		if (commands[commandType].length > 0) {
			await rest.put(route, { body: commands[commandType] });
			client?.errorLog(`Successfully reloaded ${commands[commandType].length} ${commandType} application [/] commands.`);
			this.logger.info(`Successfully reloaded ${commands[commandType].length} ${commandType} application [/] commands.`);
		}
	};

	try {
		// Deploy global commands
		await deployCommands("global", Routes.applicationCommands(client.user.id));

		// Deploy owner commands to specific guilds
		const guildIds = config.DevGuild || [];
		if (guildIds.length > 0 && commands.owner.length > 0) {
			await Promise.all(
				guildIds.map((guildId) => deployCommands("owner", Routes.applicationGuildCommands(client.user.id, guildId))),
			);
		}
	} catch (error) {
		console.error("Error during command deployment:", error);
	}
};
