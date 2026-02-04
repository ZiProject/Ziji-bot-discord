const { useHooks } = require("zihooks");
const ngrok = require("@ngrok/ngrok");

module.exports.data = {
	name: "Ngrok",
	type: "extension",
	enable: true,
};

module.exports.execute = async (client) => {
	if (!process.env.NGROK_AUTHTOKEN) return;
	if (process.env.NGROK_AUTHTOKEN == "") return;
	const logger = useHooks.get("logger");

	const url = await ngrok.forward({
		addr: process.env.SERVER_PORT || 2003,
		authtoken_from_env: true,
		on_status_change: (addr, error) => {
			logger.warn(`disconnected, addr ${addr} error: ${error}`);
		},
	});

	logger.info(`Server running on: ${url?.url()}`);
};
