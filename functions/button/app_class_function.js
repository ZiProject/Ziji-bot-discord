const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

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

module.exports = {
	name: "app_class_button",
	description: "Button sử dụng App class",
};

// Helper function sử dụng app context
function createAppStatusEmbed() {
	console.log("createAppStatusEmbed - this:", this);
	console.log("createAppStatusEmbed - this.app:", this.app);

	const embed = new EmbedBuilder()
		.setTitle("App Class Status")
		.setDescription(
			`**App Available:** ${this.app ? "Yes" : "No"}\n` +
				`**Client Ready:** ${this.client?.isReady() ? "Yes" : "No"}\n` +
				`**Bot:** ${this.client?.user?.username || "Unknown"}\n` +
				`**Guilds:** ${this.client?.guilds?.cache?.size || 0}\n` +
				`**Users:** ${this.client?.users?.cache?.size || 0}`,
		)
		.setColor(0x0099ff)
		.setTimestamp();

	return embed;
}

// Helper function để tạo buttons
function createAppButtons() {
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("refresh_app_status").setLabel("Refresh Status").setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId("app_info").setLabel("App Info").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("services_info").setLabel("Services").setStyle(ButtonStyle.Success),
	);

	return row;
}

// Helper function để lấy app information
function getAppInformation() {
	console.log("getAppInformation - this:", this);

	return {
		app: !!this.app,
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
		clientReady: this.client?.isReady() || false,
		botUsername: this.client?.user?.username || "Unknown",
		guilds: this.client?.guilds?.cache?.size || 0,
		users: this.client?.users?.cache?.size || 0,
	};
}

/**
 * @param {Object} button - Button object
 * @param {import("discord.js").ButtonInteraction} button.interaction - Discord interaction
 * @param {import('../../lang/vi.js')} button.lang - Language object
 * @this {ModuleContext}
 */
module.exports.execute = async function ({ interaction, lang }) {
	const customId = interaction.customId;

	console.log("\n=== Button Function with App Class ===");
	console.log("Button function this:", this);
	console.log("Button function this.app:", this.app);
	console.log("Button function this.client:", this.client);

	if (customId === "refresh_app_status") {
		// Sử dụng helper function với app context
		const embed = createAppStatusEmbed.call(this);
		const buttons = createAppButtons();

		await interaction.update({ embeds: [embed], components: [buttons] });
	} else if (customId === "app_info") {
		// Sử dụng helper function với app context
		const appInfo = getAppInformation.call(this);

		const embed = new EmbedBuilder()
			.setTitle("App Class Information")
			.setDescription(
				`**App:** ${appInfo.app ? "Available" : "Not Available"}\n` +
					`**Client:** ${appInfo.client ? "Available" : "Not Available"}\n` +
					`**Client Ready:** ${appInfo.clientReady ? "Yes" : "No"}\n` +
					`**Bot:** ${appInfo.botUsername}\n` +
					`**Guilds:** ${appInfo.guilds}\n` +
					`**Users:** ${appInfo.users}\n` +
					`**Manager:** ${appInfo.manager ? "Available" : "Not Available"}\n` +
					`**Config:** ${appInfo.config ? "Available" : "Not Available"}`,
			)
			.setColor(0x00ff00)
			.setTimestamp();

		await interaction.reply({ embeds: [embed], ephemeral: true });
	} else if (customId === "services_info") {
		// Sử dụng helper function với app context
		const appInfo = getAppInformation.call(this);

		const embed = new EmbedBuilder()
			.setTitle("Services Information")
			.setDescription(
				`**Core Services:**\n` +
					`- App: ${appInfo.app ? "✅" : "❌"}\n` +
					`- Client: ${appInfo.client ? "✅" : "❌"}\n` +
					`- Manager: ${appInfo.manager ? "✅" : "❌"}\n\n` +
					`**Collections:**\n` +
					`- Cooldowns: ${appInfo.cooldowns ? "✅" : "❌"}\n` +
					`- Commands: ${appInfo.commands ? "✅" : "❌"}\n` +
					`- Functions: ${appInfo.functions ? "✅" : "❌"}\n` +
					`- Responder: ${appInfo.responder ? "✅" : "❌"}\n` +
					`- Welcome: ${appInfo.welcome ? "✅" : "❌"}\n` +
					`- Giveaways: ${appInfo.giveaways ? "✅" : "❌"}\n\n` +
					`**Utilities:**\n` +
					`- Config: ${appInfo.config ? "✅" : "❌"}\n` +
					`- Logger: ${appInfo.logger ? "✅" : "❌"}`,
			)
			.setColor(0xff6b6b)
			.setTimestamp();

		await interaction.reply({ embeds: [embed], ephemeral: true });
	}
};

// Export helper functions để test từ bên ngoài
module.exports.createAppStatusEmbed = createAppStatusEmbed;
module.exports.createAppButtons = createAppButtons;
module.exports.getAppInformation = getAppInformation;
