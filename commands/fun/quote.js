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

const { Worker } = require("worker_threads");
const { MiQ } = require("makeitaquote");

module.exports.data = {
	name: "quote",
	description: "Generate a quote image.",
	type: 1, // slash command
	options: [
		{
			name: "text",
			description: "Write your quote here",
			type: 3, // string
			required: true,
		},
		{
			name: "user",
			description: "The user to display",
			type: 6,
			required: false,
		},
		{
			name: "color",
			description: "Do you need a color for your quote image?",
			type: 5,
			required: false,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	lang.quote = { error: lang?.quote?.error || "An error occurred while generating the quote image." };

	const text = await interaction.options.getString("text");
	const user = (await interaction.options.getUser("user")) || interaction.user;
	const color = (await interaction.options.getBoolean("color")) ?? true;

	const context = {
		text: text,
		backgroundImage: user.displayAvatarURL({ size: 1024, dynamic: true, format: "png" }),
		author: user.displayName,
		tag: user.username,
		bgcolor: color,
		watermark: interaction.client.user.tag,
	};

	let cardimage = await this.tryMIQ(context).catch(async (error) => {
		console.error("Error in quote MIQ:", error);
		return null;
	});

	if (!cardimage) {
		cardimage = await this.tryLocal(context).catch((error) => {
			console.error("Error in quote local:", error);
			return null;
		});
	}

	if (!cardimage) {
		await interaction.editReply({ content: lang.quote.error });
		return;
	}

	await interaction.editReply({ files: [{ attachment: cardimage, name: "quote.png" }] });
	return;
};

module.exports.tryMIQ = async (parmm) => {
	return new Promise(async (resolve, reject) => {
		const miq = new MiQ()
			.setText(parmm.text)
			.setColor(parmm.bgcolor)
			.setDisplayname(parmm.author)
			.setUsername(parmm.tag)
			.setAvatar(parmm.backgroundImage)
			.setWatermark(parmm.watermark);

		try {
			const buffer = await miq.generate();
			resolve(buffer);
		} catch (error) {
			console.error("Error in quote MIQ:", error);
			reject(error);
		}
	});
};

module.exports.tryLocal = async (parmm) => {
	return new Promise((resolve, reject) => {
		const worker = new Worker("./utility/quoteImage.js", {
			workerData: parmm,
		});

		worker.on("message", (arrayBuffer) => {
			const buffer = Buffer.from(arrayBuffer);

			if (!Buffer.isBuffer(buffer)) {
				console.error("Type of received data:", typeof buffer);
				reject(new Error("Received data is not a buffer"));
			} else {
				resolve(buffer);
			}
			worker.postMessage("terminate");
		});

		worker.on("error", (error) => {
			reject(error);
			worker.postMessage("terminate");
		});

		worker.on("exit", (code) => {
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
};
