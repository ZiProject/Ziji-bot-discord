const { EmbedBuilder } = require("discord.js");

/**
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
 */

// Helper function sử dụng app context
function getAppInfo() {
	console.log("getAppInfo - this:", this);
	console.log("getAppInfo - this.app:", this.app);

	return {
		client: !!this.client,
		clientReady: this.client?.isReady() || false,
		cooldowns: this.cooldowns?.size || 0,
		commands: this.commands?.size || 0,
		functions: this.functions?.size || 0,
		responder: this.responder?.size || 0,
		welcome: this.welcome?.size || 0,
		giveaways: !!this.giveaways,
		manager: !!this.manager,
		config: !!this.config,
		logger: !!this.logger,
	};
}

// Helper function để lấy bot statistics
function getBotStats() {
	console.log("getBotStats - this:", this);
	console.log("getBotStats - this.client:", this.client);

	if (!this.client) {
		return {
			username: "Client Not Available",
			guilds: 0,
			users: 0,
			uptime: 0,
		};
	}

	return {
		username: this.client.user?.username || "Unknown",
		guilds: this.client.guilds?.cache?.size || 0,
		users: this.client.users?.cache?.size || 0,
		uptime: this.client.uptime || 0,
		readyAt: this.client.readyAt,
	};
}

// Helper function để lấy configuration
function getConfigInfo() {
	console.log("getConfigInfo - this:", this);
	console.log("getConfigInfo - this.config:", this.config);

	return {
		hasConfig: !!this.config,
		configKeys: this.config ? Object.keys(this.config) : [],
		devConfig: this.config?.DevConfig || {},
		ownerId: this.config?.OwnerID || [],
	};
}

// Class sử dụng app context
class AppService {
	constructor() {
		console.log("AppService constructor - this:", this);
	}

	getAppStatus() {
		console.log("AppService.getAppStatus - this:", this);
		console.log("AppService.getAppStatus - this.app:", this.app);

		if (this.app) {
			return this.app.getStatus();
		}

		return {
			app: false,
			client: !!this.client,
			manager: !!this.manager,
		};
	}

	getServiceInfo() {
		console.log("AppService.getServiceInfo - this:", this);

		return {
			client: !!this.client,
			cooldowns: !!this.cooldowns,
			commands: !!this.commands,
			functions: !!this.functions,
			responder: !!this.responder,
			welcome: !!this.welcome,
			giveaways: !!this.giveaways,
			manager: !!this.manager,
			config: !!this.config,
			logger: !!this.logger,
		};
	}
}

const appService = new AppService();

module.exports.data = {
	name: "appclassdemo",
	description: "Demo sử dụng App class thay cho @zibot/zihooks",
	type: 1,
	options: [
		{
			name: "info",
			description: "Hiển thị thông tin app",
			type: 1,
		},
		{
			name: "stats",
			description: "Hiển thị thống kê bot",
			type: 1,
		},
		{
			name: "config",
			description: "Hiển thị thông tin config",
			type: 1,
		},
		{
			name: "services",
			description: "Hiển thị thông tin services",
			type: 1,
		},
	],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param {Object} command - Command object
 * @param {import("discord.js").CommandInteraction} command.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} command.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	const subcommand = interaction.options?.getSubcommand();

	console.log("\n=== Execute Function with App Class ===");
	console.log("Execute function this:", this);
	console.log("Execute function this.app:", this.app);
	console.log("Execute function this.client:", this.client);

	if (subcommand === "info") {
		// Sử dụng helper function với app context
		const appInfo = getAppInfo.call(this);

		const embed = new EmbedBuilder()
			.setTitle("App Class Information")
			.setDescription(
				`**App Available:** ${appInfo.client ? "Yes" : "No"}\n` +
					`**Client Ready:** ${appInfo.clientReady ? "Yes" : "No"}\n` +
					`**Commands:** ${appInfo.commands}\n` +
					`**Functions:** ${appInfo.functions}\n` +
					`**Cooldowns:** ${appInfo.cooldowns}\n` +
					`**Responder:** ${appInfo.responder}\n` +
					`**Welcome:** ${appInfo.welcome}\n` +
					`**Giveaways:** ${appInfo.giveaways ? "Yes" : "No"}\n` +
					`**Manager:** ${appInfo.manager ? "Yes" : "No"}\n` +
					`**Config:** ${appInfo.config ? "Yes" : "No"}\n` +
					`**Logger:** ${appInfo.logger ? "Yes" : "No"}`,
			)
			.setColor(0x0099ff)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	} else if (subcommand === "stats") {
		// Sử dụng helper function với app context
		const botStats = getBotStats.call(this);

		const embed = new EmbedBuilder()
			.setTitle("Bot Statistics")
			.setDescription(
				`**Bot:** ${botStats.username}\n` +
					`**Guilds:** ${botStats.guilds}\n` +
					`**Users:** ${botStats.users}\n` +
					`**Uptime:** ${Math.floor(botStats.uptime / 1000)}s\n` +
					`**Ready At:** ${botStats.readyAt ? `<t:${Math.floor(botStats.readyAt.getTime() / 1000)}:F>` : "Unknown"}`,
			)
			.setColor(0x00ff00)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	} else if (subcommand === "config") {
		// Sử dụng helper function với app context
		const configInfo = getConfigInfo.call(this);

		const embed = new EmbedBuilder()
			.setTitle("Configuration Information")
			.setDescription(
				`**Has Config:** ${configInfo.hasConfig ? "Yes" : "No"}\n` +
					`**Config Keys:** ${configInfo.configKeys.join(", ")}\n` +
					`**Dev Config:** ${JSON.stringify(configInfo.devConfig)}\n` +
					`**Owner ID:** ${configInfo.ownerId.join(", ")}`,
			)
			.setColor(0xff6b6b)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	} else if (subcommand === "services") {
		// Sử dụng class với app context
		const appStatus = appService.getAppStatus.call(this);
		const serviceInfo = appService.getServiceInfo.call(this);

		const embed = new EmbedBuilder()
			.setTitle("Services Information")
			.setDescription(
				`**App Status:**\n` +
					`- App: ${appStatus.app ? "Yes" : "No"}\n` +
					`- Client: ${appStatus.client ? "Yes" : "No"}\n` +
					`- Manager: ${appStatus.manager ? "Yes" : "No"}\n\n` +
					`**Service Availability:**\n` +
					`- Client: ${serviceInfo.client ? "Yes" : "No"}\n` +
					`- Cooldowns: ${serviceInfo.cooldowns ? "Yes" : "No"}\n` +
					`- Commands: ${serviceInfo.commands ? "Yes" : "No"}\n` +
					`- Functions: ${serviceInfo.functions ? "Yes" : "No"}\n` +
					`- Responder: ${serviceInfo.responder ? "Yes" : "No"}\n` +
					`- Welcome: ${serviceInfo.welcome ? "Yes" : "No"}\n` +
					`- Giveaways: ${serviceInfo.giveaways ? "Yes" : "No"}\n` +
					`- Manager: ${serviceInfo.manager ? "Yes" : "No"}\n` +
					`- Config: ${serviceInfo.config ? "Yes" : "No"}\n` +
					`- Logger: ${serviceInfo.logger ? "Yes" : "No"}`,
			)
			.setColor(0x9b59b6)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	}

	return;
};

// Export helper functions để test từ bên ngoài
module.exports.getAppInfo = getAppInfo;
module.exports.getBotStats = getBotStats;
module.exports.getConfigInfo = getConfigInfo;
module.exports.AppService = AppService;
