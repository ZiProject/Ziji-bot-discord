const { useHooks } = require("zihooks");

module.exports.data = {
	name: "loadGuildCommands",
	type: "extension",
	enable: true,
	priority: 3,
};

module.exports.execute = async () => {
	useHooks.get("logger")?.debug?.("Starting loadGuildCommands...");
	try {
		const manager = useHooks.get("functions")?.get("guildCommandManager");
		const count = await manager?.execute({ action: "loadAllToCache" });
		useHooks.get("logger")?.info?.(`Successfully loaded ${count} guild custom commands into cache.`);
	} catch (error) {
		useHooks.get("logger")?.error?.("Lỗi khi tải guild commands:", error);
	}
};
