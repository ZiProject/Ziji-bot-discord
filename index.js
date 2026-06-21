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
const { lyricsExt, voiceExt, lavalinkExt } = require("@ziplayer/extension");
const { YTexec } = require("@ziplayer/ytexecplug");
const { InfinityPlugin } = require("@ziplayer/infinity");

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
const startup = new StartupManager(client);
const logger = startup.getLogger();
const config = startup.getConfig();

// Player
const ytbplg = new YouTubePlugin({
	// debug: console.log,
	// fistStream: new YTexec().getStream,
	fallbackStream: new YTexec().getStream,
});
const transcriptDir = path.join(__dirname, "transcripts");
if (!fs.existsSync(transcriptDir)) {
	fs.mkdirSync(transcriptDir, { recursive: true });
}
//create Player Manager
const manager = new PlayerManager({
	plugins: [new TTSPlugin(), ytbplg, new SoundCloudPlugin(), new SpotifyPlugin(), new InfinityPlugin(), new AttachmentsPlugin()],
	extensions: [
		// new lavalinkExt(null, {
		// 	nodes: [
		// 		{ host: "lavalinkv4.serenetia.com", port: 443, password: "https://seretia.link/discord", secure: true },
		// 		// { host: "lavalinkv4.serenetia.com", port: 80, password: "https://seretia.link/discord", secure: false },
		// 		// { host: "sg1-nodelink.nyxbot.app", port: 3000, password: "nyxbot.app/support", secure: false },
		// 		// { host: "lavalink.triniumhost.com", port: 4333, password: "free", secure: false },
		// 	],
		// 	client: client,
		// 	debug: true,
		// }),
		new lyricsExt(),
		new voiceExt(null, { client, minimalVoiceMessageDuration: 1 }),
	],
	enableStatsCollection: true,
});

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
const TARGET_DIR = path.join(__dirname, "transcripts");
const EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000;
function cleanOldFiles() {
	console.log(`[${new Date().toLocaleString()}] Bắt đầu quét thư mục dọn dẹp...`);
	if (!fs.existsSync(TARGET_DIR)) {
		console.log("Thư mục mục tiêu không tồn tại.");
		return;
	}
	fs.readdir(TARGET_DIR, (err, files) => {
		if (err) {
			console.error("Lỗi khi đọc thư mục:", err);
			return;
		}
		const now = Date.now();
		files.forEach((file) => {
			const filePath = path.join(TARGET_DIR, file);
			fs.stat(filePath, (err, stats) => {
				if (err) {
					console.error(`Không thể lấy thông tin file ${file}:`, err);
					return;
				}
				if (stats.isFile()) {
					const fileAge = now - stats.mtime.getTime();
					if (fileAge > EXPIRE_TIME) {
						fs.unlink(filePath, (err) => {
							if (err) {
								console.error(`Lỗi khi xóa file ${file}:`, err);
							} else {
								console.log(` Đã xóa file cũ: ${file}`);
							}
						});
					}
				}
			});
		});
	});
}
cron.schedule("0 0 * * *", () => {
	cleanOldFiles();
});
cleanOldFiles();
