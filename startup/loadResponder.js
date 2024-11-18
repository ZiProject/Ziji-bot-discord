const { useDB, useResponder } = require("@zibot/zihooks");

module.exports = async () => {
	try {
		let indexs = 0;
		const responders = await useDB().ZiAutoresponder.find();
		responders.forEach((responder) => {
			const autoRes = useResponder();
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
		console.log(`Successfully reloaded ${indexs} Auto Responders.`);
	} catch (error) {
		console.error("Lỗi khi tải autoresponders:", error);
	}
};
