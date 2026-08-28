require("dotenv").config();
const { useHooks } = require("zihooks");
const path = require("node:path");
const { GiveawaysManager } = require("discord-giveaways");

const { StartupManager } = require("./startup");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const readline = require("readline");

//music player
const { default: PlayerManager } = require("ziplayer");
const { TTSPlugin, SoundCloudPlugin, YouTubePlugin, SpotifyPlugin, AttachmentsPlugin } = require("@ziplayer/plugin");
const { lyricsExt, voiceExt, lavalinkExt, AiAutoplayExtension } = require("@ziplayer/extension");
const { InfinityPlugin } = require("@ziplayer/infinity");

const client = new Client({
	rest: [{ timeout: 60_000 }],
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
	allowedMentions: { parse: ["users"], repliedUser: false },
});
const startup = new StartupManager(client);
const logger = startup.getLogger();
const config = startup.getConfig();

const manager = new PlayerManager({
	plugins: [
		new TTSPlugin(),
		new YouTubePlugin({
			// debug: console.log
		}),
		new SoundCloudPlugin(),
		new SpotifyPlugin(),
		new InfinityPlugin(),
		new AttachmentsPlugin(),
	],
	extensions: [
		new AiAutoplayExtension(process.env.GEMINI_API_KEY),
		new lyricsExt(),
		new voiceExt(null, { client, minimalVoiceMessageDuration: 1 }),
	],
	enableStatsCollection: true,
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

if (config?.DevConfig?.Giveaway) {
	useHooks.set(
		"giveaways",
		new GiveawaysManager(client, {
			storage: "./jsons/giveaways.json",
			default: { botsCanWin: false, embedColor: "Random", embedColorEnd: "#000000", reaction: "🎉" },
		}),
	);
}

const initialize = async () => {
	logger.info("Initializing Ziji Bot...");
	startup.initHooks();

	await Promise.all([
		startup.loadEvents(path.join(__dirname, "events/client"), client),
		startup.loadEvents(path.join(__dirname, "events/process"), process),
		startup.loadEvents(path.join(__dirname, "events/console"), rl),
		startup.loadEvents(path.join(__dirname, "events/player"), manager),
		startup.loadModules(path.join(__dirname, "commands"), useHooks.get("commands")),
		startup.loadModules(path.join(__dirname, "functions"), useHooks.get("functions")),
		startup.loadModules(path.join(__dirname, "extensions"), useHooks.get("extensions")),
	]);

	useHooks.set("loaders", startup.loaders);
	client.login(process.env?.TOKEN ?? config?.botConfig?.TOKEN).catch((error) => {
		logger.error("Error logging in:", error);
		logger.error("The Bot Token You Entered Into Your Project Is Incorrect Or Your Bot's INTENTS Are OFF!");
	});
};

initialize().catch((error) => logger.error("Error during initialization:", error));
