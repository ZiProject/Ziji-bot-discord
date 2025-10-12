const { useHooks } = require("@zibot/zihooks");

module.exports = async () => {
	try {
		let indexs = 0;
		const responders = await useHooks.get("db").ZiAutoresponder.find();
		responders.forEach((responder) => {
			const autoRes = useHooks.get("responder");
			if (!autoRes.has(responder.guildId)) {
				autoRes.set(responder.guildId, []);
			}
			autoRes.get(responder.guildId).push({
				trigger: responder.trigger,
				response: responder.response,
				matchMode: responder.options.matchMode,
			});
			indexs++;
		});
		useHooks.get("logger")?.info?.(`Successfully reloaded ${indexs} Auto Responders.`);
	} catch (error) {
		useHooks.get("logger")?.error?.(`Lỗi khi tải autoresponders:`, error);
	}
};
