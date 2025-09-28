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

const { parentPort, workerData } = require("worker_threads");
const { LeaderboardBuilder, Font } = require("canvacord");

async function buildImage(Leaderboard_data) {
	const { Header, Players } = Leaderboard_data;
	Font.loadDefault();
	const leaderboard = new LeaderboardBuilder().setHeader(Header).setPlayers(Players);
	const leaderboardBuffer = await leaderboard.build({ format: "png" });
	parentPort.postMessage(leaderboardBuffer.buffer); // Send as ArrayBuffer
}

// Listen for termination signal
parentPort.on("message", (message) => {
	if (message === "terminate") {
		process.exit(0); // Gracefully exit
	}
});

buildImage(workerData.Leaderboard_data).catch((error) => {
	console.error("Error in worker:", error);
	process.exit(1);
});
