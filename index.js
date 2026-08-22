require("dotenv").config();
const { useHooks } = require("zihooks");
const path = require("node:path");
const { GiveawaysManager } = require("discord-giveaways");
const cron = require("node-cron");

const { StartupManager } = require("./startup");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const readline = require("readline");
const fs = require("fs");

//music player
const { default: PlayerManager } = require("ziplayer");
const { TTSPlugin, YTSRPlugin, SoundCloudPlugin, YouTubePlugin, SpotifyPlugin, AttachmentsPlugin } = require("@ziplayer/plugin");
const { lyricsExt, voiceExt, lavalinkExt, AiAutoplayExtension } = require("@ziplayer/extension");
const { YTexec } = require("@ziplayer/ytexecplug");
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

const ytbplg = new YouTubePlugin({ fallbackStream: new YTexec().getStream });
const transcriptDir = path.join(__dirname, "transcripts");
if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });

const manager = new PlayerManager({
	plugins: [new TTSPlugin(), ytbplg, new SoundCloudPlugin(), new SpotifyPlugin(), new InfinityPlugin(), new AttachmentsPlugin()],
	extensions: [
		new AiAutoplayExtension(process.env.GEMINI_API_KEY),
		new lyricsExt(),
		new voiceExt(null, { client, minimalVoiceMessageDuration: 1 }),
	],
	enableStatsCollection: true,
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

if (config?.DevConfig?.Giveaway) {
	useHooks.set("giveaways", new GiveawaysManager(client, {
		storage: "./jsons/giveaways.json",
		default: { botsCanWin: false, embedColor: "Random", embedColorEnd: "#000000", reaction: "🎉" },
	}));
}

const initialize = async () => {
	logger.info("Initializing Ziji Bot...");
	startup.initHooks();

	const { Loader } = await import("@ziji/loader");
	const loaders = [];

	const loadModules = async (directory, collection) => {
		const loader = new Loader({
			recursive: true,
			watch: process.env.NODE_ENV === "development",
			debounce: 150,
			throwOnError: false,
			check(module) {
				return !!module && typeof module === "object" && "data" in module && typeof module.execute === "function";
			},
			init(module, ctx) {
				const disabled = config?.disabledCommands?.includes(module?.data?.name) || module?.data?.enable === false;
				if (disabled) return;

				if (collection) collection.set(module.data.name, module);
				const messageCommands = useHooks.get("Mcommands");
				const aliases = Array.isArray(module.data?.alias) ? module.data.alias : [];

				if (messageCommands) {
					messageCommands.set(module.data.name, module);
					for (const alias of aliases) {
						if (!messageCommands.has(alias)) messageCommands.set(alias, module);
					}
				}

				ctx.signal.addEventListener("abort", () => {
					if (collection?.get(module.data.name) === module) collection.delete(module.data.name);
					if (!messageCommands) return;
					if (messageCommands.get(module.data.name) === module) messageCommands.delete(module.data.name);
					for (const alias of aliases) {
						if (messageCommands.get(alias) === module) messageCommands.delete(alias);
					}
				}, { once: true });
			},
		});
		loaders.push(loader);
		const result = await loader.load(directory);
		for (const failure of result.failed) logger.error(`Failed to load ${failure.path}:`, failure.error);
		return result;
	};

	const loadEvents = async (directory, target) => {
		const loader = new Loader({
			recursive: true,
			watch: process.env.NODE_ENV === "development",
			debounce: 150,
			throwOnError: false,
			check(module) {
				return !!module && typeof module === "object" && typeof module.name === "string" && typeof module.execute === "function";
			},
			init(module, ctx) {
				if (module.enable === false) return;
				const handler = async (...args) => {
					try {
						await module.execute(...args);
					} catch (error) {
						logger.error(`Error executing event ${module.name}:`, error);
					}
				};
				if (module.once) target.once(module.name, handler);
				else target.on(module.name, handler);
				ctx.signal.addEventListener("abort", () => {
					target.off(module.name, handler);
				}, { once: true });
			},
		});
		loaders.push(loader);
		const result = await loader.load(directory);
		for (const failure of result.failed) logger.error(`Failed to load event ${failure.path}:`, failure.error);
		return result;
	};

	await Promise.all([
		loadEvents(path.join(__dirname, "events/client"), client),
		loadEvents(path.join(__dirname, "events/process"), process),
		loadEvents(path.join(__dirname, "events/console"), rl),
		loadEvents(path.join(__dirname, "events/player"), manager),
		loadModules(path.join(__dirname, "commands"), useHooks.get("commands")),
		loadModules(path.join(__dirname, "functions"), useHooks.get("functions")),
		loadModules(path.join(__dirname, "extensions"), useHooks.get("extensions")),
	]);

	useHooks.set("loaders", loaders);
	client.login(process.env?.TOKEN ?? config?.botConfig?.TOKEN).catch((error) => {
		logger.error("Error logging in:", error);
		logger.error("The Bot Token You Entered Into Your Project Is Incorrect Or Your Bot's INTENTS Are OFF!");
	});
};

initialize().catch((error) => logger.error("Error during initialization:", error));
