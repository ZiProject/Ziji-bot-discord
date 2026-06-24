const { useHooks } = require("zihooks");

module.exports.execute = async () => {
	const logger = useHooks.get("logger");

	logger?.debug?.("[Temp] Loading cache...");

	try {
		const db = useHooks.get("db");

		const temp = useHooks.get("temp");

		const guildSettings = new Map();
		const joinToCreateCache = new Map();
		const afkCache = new Map();
		const customWords = new Set();

		if (db) {
			const guilds = await db.ZiGuild.find(
				{},
				{
					guildId: 1,
					music_channel: 1,
					joinToCreate: 1,
					voice: 1,
				},
			).lean();

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

			if (db.ZiUser) {
				const afkUsers = await db.ZiUser.find(
					{ afk: true },
					{
						userID: 1,
						afk: 1,
						afkReason: 1,
						afkTime: 1,
					},
				).lean();

				for (const user of afkUsers) {
					if (user.userID) {
						afkCache.set(user.userID, {
							afk: user.afk,
							afkReason: user.afkReason,
							afkTime: user.afkTime,
						});
					}
				}
			}

			if (db.ZiData) {
				const dbWords = await db.ZiData.find({ type: "wordgame_words" }).lean();
				for (const item of dbWords) {
					if (item.key) {
						customWords.add(item.key.toLowerCase().trim());
					}
				}
			}
		}

		useHooks.set("guildSettings", guildSettings);
		useHooks.set("joinToCreateCache", joinToCreateCache);
		useHooks.set("afkCache", afkCache);
		useHooks.set("customWords", customWords);

		logger?.debug?.(
			`[Temp] Loaded ${guildSettings.size} guild settings, ${afkCache.size} AFK users, and ${customWords.size} custom words`,
		);
	} catch (error) {
		useHooks.get("logger")?.error?.("[Temp] Load cache failed", error);
	}
};

module.exports.data = {
	name: "loadTemp",
	type: "extension",
	enable: true,
};
