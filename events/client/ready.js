const { Events, Client, ActivityType } = require("discord.js");
const deploy = require("../../startup/deploy");
const { useHooks } = require("zihooks");
const { connectPrismaDatabase } = require("../../startup/prismaDB");

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

		const initDatabase = async () => {
			try {
				if (!process.env.MONGO) throw new Error("MONGO is not configured");
				const db = await connectPrismaDatabase("mongodb", { logger });
				useHooks.set("db", db);
				logger?.info?.("Connected to MongoDB with Prisma!");
				client.errorLog("Connected to MongoDB with Prisma!");
			} catch (mongoError) {
				logger?.error?.(`MongoDB Prisma connection failed: ${mongoError.message}`);
				try {
					const db = await connectPrismaDatabase("sqlite", { logger });
					useHooks.set("db", db);
					logger?.info?.("Connected to SQLite with Prisma!");
					client.errorLog("Connected to SQLite with Prisma!");
				} catch (sqliteError) {
					logger?.error?.(`SQLite Prisma fallback failed: ${sqliteError.message}`);
					client.errorLog(`SQLite Prisma fallback failed: ${sqliteError.message}`);
				}
			}
		};

		await Promise.all([config?.deploy ? deploy(client).catch(() => null) : null, initDatabase()]);

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
