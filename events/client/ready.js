const { Events, Client, ActivityType } = require("discord.js");
const deploy = require("../../startup/deploy");
const mongoose = require("mongoose");
const { useHooks } = require("zihooks");
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
		const config = useHooks.get("config");
		const logger = useHooks.get("logger");
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
				logger?.error?.("Lỗi khi gửi tin nhắn lỗi:", error);
			}
		};

		// Use Promise.all to handle MongoDB connection and deployment concurrently
		const [deployResult, mongoConnected] = await Promise.all([
			config?.deploy ? deploy(client).catch(() => null) : null,
			mongoose.connect(process.env.MONGO).catch(() => false),
		]);

		if (!mongoConnected) {
			logger?.error?.("Failed to connect to MongoDB!");
			const db = new Database("./jsons/ziDB.json");
			useHooks.set("db", {
				ZiUser: createModel(db, "ZiUser"),
				ZiAutoresponder: createModel(db, "ZiAutoresponder"),
				ZiWelcome: createModel(db, "ZiWelcome"),
				ZiGuild: createModel(db, "ZiGuild"),
			});

			logger?.info?.("Connected to LocalDB!");
			client.errorLog("Connected to LocalDB!");
		} else {
			useHooks.set("db", require("../../startup/mongoDB"));
			logger?.info?.("Connected to MongoDB!");
			client.errorLog("Connected to MongoDB!");
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

		for (let priority = 1; priority <= 10; priority++) {
			let res = await Promise.all(
				useHooks.get("extensions").map(async (extension) => {
					extension.data.priority = extension.data?.priority ?? 10;
					if (extension.data.enable && extension.data.priority === priority && typeof extension.execute === "function") {
						logger?.debug?.(`Loaded extension: ${extension.data.name} (priority: ${priority})`);
						return await extension.execute(client);
					}
				}),
			);
		}
		logger?.info?.(`Ready! Logged in as ${client.user.tag}`);
		client.errorLog(`Ready! Logged in as ${client.user.tag}`);
	},
};
