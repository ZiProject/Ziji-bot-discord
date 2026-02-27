const { StartupLoader } = require("./loader.js");
const { LoggerFactory } = require("./logger.js");
const { useHooks } = require("zihooks");
const { Collection } = require("discord.js");
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const zzicon = require("./../utility/icon.js");

class StartupManager {
	constructor(client) {
		this.client = client;
		this.config = this.initCongig();
		this.logger = LoggerFactory.create(this.config);
		this.loader = new StartupLoader(this.config, this.logger);
		this.createFile("./jsons");
		this.web = this.initWeb();
	}

	initCongig() {
		try {
			this.config = require("../config");
		} catch {
			console.warn("No config file found, using default configuration.");
			this.config = require("./defaultconfig");
		}

		useHooks.set("config", this.config);
		return this.config;
	}

	initWeb() {
		this.logger.debug?.("Starting web...");
		const app = express();
		const server = http.createServer(app);
		const wss = new WebSocket.Server({ server });

		app.use(
			cors({
				origin: getAllowedOrigins(),
				methods: ["GET", "POST"],
				credentials: true,
			}),
		);

		app.use(express.json());

		server.listen(process.env.SERVER_PORT || 2003, () => {
			this.logger.info(`Server running on port ${process.env.SERVER_PORT || 2003}`);
		});

		return { server: app, wss };
	}

	getConfig() {
		return this.config;
	}

	getLogger() {
		return this.logger;
	}

	loadFiles(directory, collection) {
		return this.loader.loadFiles(directory, collection);
	}

	loadEvents(directory, target) {
		return this.loader.loadEvents(directory, target);
	}

	createFile(directory) {
		return this.loader.createDirectory(directory);
	}

	initHooks() {
		useHooks.set("config", this.config); // Configuration
		useHooks.set("client", this.client); // Discord client
		useHooks.set("welcome", new Collection()); // Welcome messages
		useHooks.set("cooldowns", new Collection()); // Cooldowns
		useHooks.set("responder", new Collection()); // Auto Responder
		useHooks.set("commands", new Collection()); // Slash Commands
		useHooks.set("Mcommands", new Collection()); // Message Commands
		useHooks.set("functions", new Collection()); // Functions
		useHooks.set("extensions", new Collection()); // Extensions
		useHooks.set("logger", this.logger); // LoggerFactory
		useHooks.set("wss", this.web.wss); // WebSocket Server
		useHooks.set("server", this.web.server); // Web Server
		useHooks.set("icon", zzicon); // Icon
	}
}

const getAllowedOrigins = () => {
	const raw = process.env.CORS_ORIGIN;

	// 1. Trường hợp không định nghĩa hoặc là '*'
	if (!raw || raw === "*") return "*";

	// 2. Trường hợp là một mảng giả lập (chuỗi cách nhau bởi dấu phẩy)
	// Ví dụ: CORS_ORIGIN=http://localhost:3000,https://ziji.world
	if (raw.includes(",")) {
		return raw.split(",").map((origin) => origin.trim());
	}

	// 3. Trường hợp là một String duy nhất
	return raw;
};

module.exports = { StartupManager };
