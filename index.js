require("dotenv").config();
const { useHooks } = require("zihooks");
const path = require("node:path");
const { GiveawaysManager } = require("discord-giveaways");

const { StartupManager } = require("./startup");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const readline = require("readline");

//music player
const { default: PlayerManager } = require("ziplayer");
const { TTSPlugin, YTSRPlugin, SoundCloudPlugin, YouTubePlugin, SpotifyPlugin, AttachmentsPlugin } = require("@ziplayer/plugin");
const { lyricsExt, voiceExt } = require("@ziplayer/extension");
const { YTexec } = require("@ziplayer/ytexecplug");
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
const ytbplg = new YouTubePlugin({ player: null });

ytbplg.getStream = new YTexec().getStream;

//create Player Manager
const manager = new PlayerManager({
	plugins: [new TTSPlugin(), ytbplg, new SoundCloudPlugin(), new SpotifyPlugin(), new AttachmentsPlugin()],
	extensions: [new lyricsExt(), new voiceExt(null, { client, minimalVoiceMessageDuration: 1 })],
});
manager.create("search");

const startup = new StartupManager(client);
const logger = startup.getLogger();
const config = startup.getConfig();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

if (config?.DevConfig?.Giveaway) {
	useHooks.set(
		"giveaways",
		new GiveawaysManager(client, {
			storage: "./jsons/giveaways.json",
			default: {
				botsCanWin: false,
				embedColor: "Random",
				embedColorEnd: "#000000",
				reaction: "🎉",
			},
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
		startup.loadFiles(path.join(__dirname, "commands"), useHooks.get("commands")),
		startup.loadFiles(path.join(__dirname, "functions"), useHooks.get("functions")),
		startup.loadFiles(path.join(__dirname, "extensions"), useHooks.get("extensions")),
	]);
	client.login(process.env?.TOKEN ?? config?.botConfig?.TOKEN).catch((error) => {
		logger.error("Error logging in:", error);
		logger.error("The Bot Token You Entered Into Your Project Is Incorrect Or Your Bot's INTENTS Are OFF!");
	});
};

initialize().catch((error) => {
	logger.error("Error during initialization:", error);
});
