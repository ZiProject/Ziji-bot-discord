const { useHooks } = require("zihooks");

module.exports.data = {
	name: "routesIndex",
	description: "Index of all route modules",
	version: "1.0.0",
	enable: true,
};

module.exports.execute = (client) => {
	const app = useHooks.get("server");

	app.get("/", (req, res) => {
		if (!client.isReady())
			return res.json({
				status: "NG",
				content: "API loading...!",
			});

		res.json({
			status: "OK",
			content: "Welcome to API!",
			clientName: client?.user?.displayName,
			clientId: client?.user?.id,
			avatars: client?.user?.displayAvatarURL({ size: 1024 }),
		});
	});

	app.get("/api/health", (req, res) => {
		res.json({ status: "ok" });
	});

	return;
};
