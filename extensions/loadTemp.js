const { useHooks } = require("zihooks");

module.exports.execute = async () => {
	const logger = useHooks.get("logger");

	logger?.debug?.("[Temp] Loading cache...");

	try {
		const db = useHooks.get("db");

		if (!db) return;

		const guilds = await db.ZiGuild.find(
			{},
			{
				guildId: 1,
				music_channel: 1,
				joinToCreate: 1,
				voice: 1,
			},
		).lean();

		const temp = useHooks.get("temp");

		const guildSettings = new Map();
		const joinToCreateCache = new Map();

		for (const guild of guilds) {
			const guildId = guild.guildId;

			guildSettings.set(guildId, guild);

			if (guild.music_channel) {
				temp.set(`music_channel_${guildId}`, guild.music_channel);
			}

			if (guild.joinToCreate?.enabled) {
				joinToCreateCache.set(guild.joinToCreate.voiceChannelId, {
					guildId,
					...guild.joinToCreate,
				});
			}
		}

		useHooks.set("guildSettings", guildSettings);
		useHooks.set("joinToCreateCache", joinToCreateCache);

		logger?.debug?.(`[Temp] Loaded ${guilds.length} guild settings`);
	} catch (error) {
		useHooks.get("logger")?.error?.("[Temp] Load cache failed", error);
	}
};

module.exports.data = {
	name: "loadTemp",
	type: "extension",
	enable: true,
};
