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

require("dotenv").config();
const { startServer } = require("./web");
const { appManager } = require("./core/AppManager");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const readline = require("readline");

// Import configuration
const config = require("./config");

// Optimized client configuration
const client = new Client({
	rest: { 
		timeout: 60_000,
		retries: 3,
		offset: 0
	},
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.User, Partials.GuildMember, Partials.Message, Partials.Channel],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false,
	},
	// Performance optimizations
	shards: "auto",
	closeTimeout: 5000,
});

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const initialize = async () => {
	try {
		// Initialize startup manager first
		const startup = new (require("./startup").StartupManager)(config);
		const logger = startup.getLogger();

		logger.info("Initializing Ziji Bot with App class...");
		
		// Check for updates in background
		setImmediate(() => startup.checkForUpdates());

		// Initialize app with optimized configuration
		const app = appManager.initialize({
			config,
			logger,
			enableGiveaways: config.DevConfig?.Giveaway,
			giveawayStorage: "./jsons/giveaways.json",
		});

		// Initialize app with client
		await app.initialize(client);

		// Set up collections directly in app
		app.cooldowns = new Collection();
		app.welcome = new Collection();
		app.responder = new Collection();

		const playerManager = app.getManager();

		// Parallel loading for better performance
		const loadPromises = [
			startup.loadEvents(path.join(__dirname, "events/client"), client, app),
			startup.loadEvents(path.join(__dirname, "events/process"), process, app),
			startup.loadEvents(path.join(__dirname, "events/console"), rl, app),
			startup.loadFiles(path.join(__dirname, "commands"), app.commands, app),
			startup.loadFiles(path.join(__dirname, "functions"), app.functions, app),
		];

		// Add player events if manager exists
		if (playerManager) {
			loadPromises.push(startup.loadEvents(path.join(__dirname, "events/player"), playerManager, app));
		}

		// Add web server if enabled
		if (config.webAppConfig?.enabled) {
			loadPromises.push(
				Promise.resolve(startServer.bind(app)()).catch((error) => 
					logger.error("Error starting web server:", error)
				)
			);
		}

		// Wait for all loading operations to complete
		await Promise.all(loadPromises);

		logger.info("All modules loaded successfully");

		// Login to Discord
		await client.login(process.env.TOKEN);
		
	} catch (error) {
		console.error("Critical error during initialization:", error);
		process.exit(1);
	}
};

initialize().catch((error) => {
	console.error("Error during initialization:", error);
});
