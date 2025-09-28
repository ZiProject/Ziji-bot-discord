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

// Initialize app
const app = appManager.initialize({
	config,
	logger: console,
	enableGiveaways: config.DevConfig?.Giveaway,
	giveawayStorage: "./jsons/giveaways.json",
});

const startup = new (require("./startup").StartupManager)(config);
const logger = startup.getLogger();

const client = new Client({
	rest: [{ timeout: 60_000 }],
	intents: [
		GatewayIntentBits.Guilds, // for guild related things
		GatewayIntentBits.GuildVoiceStates, // for voice related things
		GatewayIntentBits.GuildMessageReactions, // for message reactions things
		GatewayIntentBits.GuildMembers, // for guild members related things
		// GatewayIntentBits.GuildEmojisAndStickers, // for manage emojis and stickers
		// GatewayIntentBits.GuildIntegrations, // for discord Integrations
		// GatewayIntentBits.GuildWebhooks, // for discord webhooks
		GatewayIntentBits.GuildInvites, // for guild invite managing
		// GatewayIntentBits.GuildPresences, // for user presence things
		GatewayIntentBits.GuildMessages, // for guild messages things
		// GatewayIntentBits.GuildMessageTyping, // for message typing things
		GatewayIntentBits.DirectMessages, // for dm messages
		GatewayIntentBits.DirectMessageReactions, // for dm message reaction
		// GatewayIntentBits.DirectMessageTyping, // for dm message typinh
		GatewayIntentBits.MessageContent, // enable if you need message content things
	],
	partials: [Partials.User, Partials.GuildMember, Partials.Message, Partials.Channel],
	allowedMentions: {
		parse: ["users"],
		repliedUser: false,
	},
});

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const initialize = async () => {
	logger.info("Initializing Ziji Bot with App class...");
	startup.checkForUpdates();

	// Initialize app with client
	await app.initialize(client);

	// Set up collections directly in app
	app.cooldowns = new Collection();
	app.welcome = new Collection();
	app.responder = new Collection();

	await Promise.all([
		startup.loadEvents(path.join(__dirname, "events/client"), client, app),
		startup.loadEvents(path.join(__dirname, "events/process"), process, app),
		startup.loadEvents(path.join(__dirname, "events/console"), rl, app),
		startup.loadEvents(path.join(__dirname, "events/player"), app.getManager(), app),
		startup.loadFiles(path.join(__dirname, "commands"), app.commands, app),
		startup.loadFiles(path.join(__dirname, "functions"), app.functions, app),
		startServer().catch((error) => logger.error("Error start Server:", error)),
	]);

	client.login(process.env.TOKEN).catch((error) => {
		logger.error("Error logging in:", error);
		logger.error("The Bot Token You Entered Into Your Project Is Incorrect Or Your Bot's INTENTS Are OFF!");
	});
};

initialize().catch((error) => {
	logger.error("Error during initialization:", error);
});
