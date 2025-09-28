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
const { QuoteCard } = require("./QuoteCard");

async function buildImage() {
	/**
     * 	setText(value) {
		this.options.set("text", value);
		return this;
	}

	setAuthor(value) {
		this.options.set("author", value);
		return this;
	}

	setTag(value) {
		this.options.set("tag", value);
		return this;
	}

	setWatermark(value) {
		this.options.set("watermark", value);
		return this;
	}

	setBackgroundImage(value) {
		this.options.set("backgroundImage", value);
		return this;
	}
     */
	const { text, backgroundImage, author, tag, bgcolor, watermark } = workerData;
	const card = new QuoteCard()
		.setBackgroundImage(backgroundImage)
		.setText(text)
		.setAuthor(author)
		.setTag(tag)
		.setWatermark(watermark);

	if (!bgcolor) {
		console.log("Color is false, setting bgcolor to false");
		card.setColor(false);
	}

	const buffer = await card.build({ format: "png" });
	parentPort.postMessage(buffer.buffer);
}

parentPort.on("message", (message) => {
	if (message === "terminate") {
		process.exit(0);
	}
});

buildImage().catch((error) => {
	console.error("Error in worker:", error);
	process.exit(1);
});
