const { useHooks } = require("@zibot/zihooks");
const ngrok = require("ngrok");

module.exports.data = {
	name: "Ngrok",
	type: "extension",
	enable: true,
};

module.exports.execute = async (client) => {
	if (!useHooks.get("config")?.webAppConfig?.enabled) return;
	if (!process.env.NGROK_AUTHTOKEN) return;
	if (process.env.NGROK_AUTHTOKEN == "") return;

	const url = await ngrok.connect({
		addr: process.env.SERVER_PORT || 2003,
		hostname: process.env.NGROK_DOMAIN,
		authtoken: process.env.NGROK_AUTHTOKEN,
	});
	logger.info(`Server running on ${url}`);
};
