require("dotenv").config();
const { startServer } = require("./web");
const {
	useAI,
	useClient,
	useCooldowns,
	useCommands,
	useFunctions,
	useGiveaways,
	useConfig,
	useResponder,
	useWelcome,
	useLogger,
} = require("@zibot/zihooks");
const path = require("node:path");
const winston = require("winston");
const util = require("util");
const { Player } = require("discord-player");
const config = useConfig(require("./config"));
const { GiveawaysManager } = require("discord-giveaways");
const { YoutubeiExtractor } = require("discord-player-youtubei");
const { loadFiles, loadEvents } = require("./startup/loader.js");
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { ZiExtractor, useZiVoiceExtractor, TextToSpeech } = require("@zibot/ziextractor");
const { DefaultExtractors } = require("@discord-player/extractor");
const readline = require("readline");
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

// Configure logger
const logger = useLogger(
	winston.createLogger({
		level: config.DevConfig?.logger || "info",
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.printf(
				({ level, message, timestamp }) =>
					`[${timestamp}] [${level.toUpperCase()}]:` + util.inspect(message, { showHidden: false, depth: 2, colors: true }),
			),
		),
		transports: [
			new winston.transports.Console({
				format: winston.format.printf(
					({ level, message }) =>
						`[${level.toUpperCase()}]:` + util.inspect(message, { showHidden: false, depth: 2, colors: true }),
				),
			}),
			new winston.transports.File({ filename: "bot.log" }),
		],
	}),
);

if (config.DevConfig.ai && process.env?.GEMINI_API_KEY?.length) {
	const { GoogleGenerativeAI } = require("@google/generative-ai");
	const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
	useAI({
		client,
		genAI,
		run: async (prompt) => {
			const generationConfig = {
				stopSequences: ["red"],
				temperature: 0.9,
				topP: 0.1,
				topK: 16,
			};
			const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });
			const result = await model.generateContent(prompt, {});
			const response = await result.response;
			const text = response.text();
			return text;
		},
	});
}

const player = new Player(client, {
	skipFFmpeg: false,
});

player.setMaxListeners(100);
if (config.DevConfig.YoutubeiExtractor) {
	player.extractors.register(YoutubeiExtractor, {});
	require("youtubei.js").Log.setLevel(0);
}

if (config.DevConfig.ZiExtractor) player.extractors.register(ZiExtractor, {});

player.extractors.register(TextToSpeech, {});
player.extractors.loadMulti(DefaultExtractors);

// Debug
if (config.DevConfig.DJS_DEBUG) client.on("debug", (m) => logger.debug(m));
if (config.DevConfig.DPe_DEBUG) player.events.on("debug", (m) => logger.debug(m));
if (config.DevConfig.DP_DEBUG) {
	logger.debug(player.scanDeps());
	player.on("debug", (m) => logger.debug(m));
}
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// Xử lý các lệnh nhập từ console
rl.on("line", (input) => {
	const args = input.trim().split(/ +/);
	const command = args.shift().toLowerCase();

	switch (command) {
		case "status":
			logger.info(`Bot đang ${client.isReady() ? "hoạt động" : "tắt"}`);
			break;
		case "stop":
			logger.info("Đang tắt bot...");
			client.destroy();
			process.exit(0);
			break;
		case "ping":
			logger.info(`Pong! Độ trễ của bot là ${client.ws.ping}ms`);
			break;
		case "help":
			logger.info(
				`Danh sách các lệnh:\n- help: Hiển thị trợ giúp\n- ping: Hiển thị độ trễ bot\n- stop: Tắt bot\n- status: Trả về trạng thái bot`,
			);
			break;
		default:
			logger.error(`Lệnh không hợp lệ: ${command}`);
	}
});
useGiveaways(
	config.DevConfig.Giveaway ?
		new GiveawaysManager(client, {
			storage: "./jsons/giveaways.json",
			default: {
				botsCanWin: false,
				embedColor: "Random",
				embedColorEnd: "#000000",
				reaction: "🎉",
			},
		})
	:	() => false,
);

const ziVoice = useZiVoiceExtractor({
	ignoreBots: true,
	minimalVoiceMessageDuration: 1,
	lang: "vi-VN",
});

const initialize = async () => {
	useClient(client);
	useWelcome(new Collection());
	useCooldowns(new Collection());
	useResponder(new Collection());
	await Promise.all([
		loadEvents(path.join(__dirname, "events/client"), client),
		loadEvents(path.join(__dirname, "events/voice"), ziVoice),
		loadEvents(path.join(__dirname, "events/process"), process),
		loadEvents(path.join(__dirname, "events/player"), player.events),
		loadFiles(path.join(__dirname, "commands"), useCommands(new Collection())),
		loadFiles(path.join(__dirname, "functions"), useFunctions(new Collection())),
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
