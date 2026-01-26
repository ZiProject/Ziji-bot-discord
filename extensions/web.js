const express = require("express");
const cors = require("cors");
const { useHooks } = require("zihooks");
const http = require("http");

const { searchRoutes, streamRoutes, lyricsRoutes, suggestionsRoutes, WebSocketServer } = require("./routes/index.js");

module.exports.execute = async () => {
	if (!useHooks.get("config")?.webAppConfig?.enabled) return;
	useHooks.get("logger")?.debug?.("Starting web...");
	const logger = useHooks.get("logger");
	const client = useHooks.get("client");

	const app = express();
	const server = http.createServer(app);
	const wss = new WebSocketServer(server);

	app.use(
		cors({
			origin: "*",
			methods: ["GET", "POST"],
			credentials: true,
		}),
	);

	app.use(express.json());

	server.listen(process.env.SERVER_PORT || 2003, () => {
		logger.info(`Server running on port ${process.env.SERVER_PORT || 2003}`);
	});

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

	app.use("/api/search", searchRoutes);
	app.use("/api/stream", streamRoutes);
	app.use("/api/lyrics", lyricsRoutes);
	app.use("/api/suggestions", suggestionsRoutes);
	wss.start(logger);
};

module.exports.data = {
	name: "web",
	type: "extension",
	enable: true,
};
