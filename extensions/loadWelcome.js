const { useHooks } = require("zihooks");

module.exports.execute = async () => {
	useHooks.get("logger")?.debug?.("Starting loadWelcome...");
	try {
		let indexs = 0;
		const Welcome = await useHooks.get("db").ZiWelcome.find();
		Welcome.forEach((r) => {
			const Res = useHooks.get("welcome");
			if (!Res.has(r.guildId)) {
				Res.set(r.guildId, []);
			}
			Res.get(r.guildId).push({
				channel: r.channel,
				content: r.content,
				Bchannel: r.Bchannel,
				Bcontent: r.Bcontent,
			});
			indexs++;
		});
		useHooks.get("logger")?.info?.(`Successfully reloaded ${indexs} welcome.`);
	} catch (error) {
		useHooks.get("logger")?.error?.(`Lỗi khi tải welcome:`, error);
	}
};

module.exports.data = {
	name: "loadWelcome",
	type: "extension",
	enable: true,
};
