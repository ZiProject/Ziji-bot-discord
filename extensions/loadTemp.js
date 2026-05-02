const { useHooks } = require("zihooks");

module.exports.execute = async () => {
	useHooks.get("logger")?.debug?.("Starting loadTemp...");
	try {
		// music channel
		const musicChannels = await useHooks.get("db").ZiGuild.find({ music_channel: { $exists: true } });
		if (!musicChannels || musicChannels.length === 0) return;

		musicChannels.forEach((guild) => {
			useHooks.get("temp").set(`music_channel_${guild.guildId}`, guild.music_channel);
		});
	} catch (error) {
		useHooks.get("logger")?.error?.(`Lỗi khi tải temp:`, error);
	}
};

module.exports.data = {
	name: "loadTemp",
	type: "extension",
	enable: true,
};
