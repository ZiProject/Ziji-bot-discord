const { Events, Client, ActivityType } = require("discord.js");
const { useHooks } = require("zihooks");

module.exports = {
	name: Events.ClientReady,
	type: "events",
	once: true,
	/**
	 * @param { Client } client
	 */
	execute: async (client) => {
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

		client.user.setStatus(config?.botConfig?.Status || "online");
		client.user.setActivity({
			name: config?.botConfig?.ActivityName || "ziji",
			type: ActivityType[config?.botConfig?.ActivityType] || ActivityType.Playing,
			timestamps: {
				start: Date.now(),
			},
		});

		logger?.info?.(`Ready! Logged in as ${client.user.tag}`);
		client.errorLog(`Ready! Logged in as ${client.user.tag}`);
	},
};
