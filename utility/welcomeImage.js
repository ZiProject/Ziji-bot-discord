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
const { GreetingsCard } = require("./GreetingsCard");

async function buildImage(workerData) {
	const { ZDisplayName, ZType, ZAvatar, ZMessage, ZImage } = workerData;
	const card = new GreetingsCard().setDisplayName(ZDisplayName).setType(ZType).setAvatar(ZAvatar).setMessage(ZMessage);

	const buffer = await card.build({ format: "png" });
	parentPort.postMessage(buffer.buffer); // Send as ArrayBuffer
}

// Listen for termination signal
parentPort.on("message", (message) => {
	if (message === "terminate") {
		process.exit(0); // Gracefully exit
	}
});

buildImage(workerData).catch((error) => {
	console.error("Error in worker:", error);
	process.exit(1);
});
