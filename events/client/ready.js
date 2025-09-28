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

const { Events, Client, ActivityType } = require("discord.js");
const config = require("../../config");
const deploy = require("../../startup/deploy");
const mongoose = require("mongoose");
const { Database, createModel } = require("@zibot/db");

module.exports = {
	name: Events.ClientReady,
	type: "events",
	once: true,
	/**
	 * @param { Client } client
	 */
	execute: async (client) => {
		/**
		 * @param { String } messenger
		 */
		client.errorLog = async (messenger) => {
			if (!config?.botConfig?.ErrorLog) return;
			try {
				const channel = await client.channels.fetch(config?.botConfig?.ErrorLog).catch(() => null);
				if (channel) {
					const text = `[<t:${Math.floor(Date.now() / 1000)}:R>] ${messenger}`;
					for (let i = 0; i < text.length; i += 1000) {
						await channel.send(text.slice(i, i + 1000)).catch(() => {});
					}
				}
			} catch (error) {
				this.logger?.error("Lỗi khi gửi tin nhắn lỗi:", error);
			}
		};

		// Use Promise.all to handle MongoDB connection and deployment concurrently
		const [deployResult, mongoConnected] = await Promise.all([
			config?.deploy ? deploy(client).catch(() => null) : null,
			mongoose.connect(process.env.MONGO).catch(() => false),
		]);

		if (mongoConnected) {
			this.db = require("../../startup/mongoDB");
			await require("../../startup/loadResponder")();
			await require("../../startup/loadWelcome")();
			await require("../../startup/initAI")();

			this.logger?.info("Connected to MongoDB!");
			client.errorLog("Connected to MongoDB!");
		} else {
			this.logger?.error("Failed to connect to MongoDB!");
			const db = new Database("./jsons/ziDB.json");
			this.db = {
				ZiUser: createModel(db, "ZiUser"),
				ZiAutoresponder: createModel(db, "ZiAutoresponder"),
				ZiWelcome: createModel(db, "ZiWelcome"),
				ZiGuild: createModel(db, "ZiGuild"),
			};
			await require("../../startup/loadResponder")();
			await require("../../startup/loadWelcome")();
			await require("../../startup/initAI")();
			this.logger?.info("Connected to LocalDB!");
			client.errorLog("Connected to LocalDB!");
		}

		// Set Activity status
		client.user.setStatus(config?.botConfig?.Status || "online");
		client.user.setActivity({
			name: config?.botConfig?.ActivityName || "ziji",
			type: ActivityType[config?.botConfig?.ActivityType] || ActivityType.Playing,
			timestamps: {
				start: Date.now(),
			},
		});

		this.logger?.info(`Ready! Logged in as ${client.user.tag}`);
		client.errorLog(`Ready! Logged in as ${client.user.tag}`);
	},
};
