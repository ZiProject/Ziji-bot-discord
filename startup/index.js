const { LoggerFactory } = require("./logger.js");
const { useHooks } = require("zihooks");
const { GatewayIntentBits, Client, Collection } = require("discord.js");
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
		this.createFile("./jsons");
		this.web = this.initWeb();
		this.initPlayerNet();
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
		const wss = new WebSocket.Server({ server, path: "/ws" });
		const corsOptions = {
			origin: getAllowedOrigins(),
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
		};

		app.use(cors(corsOptions));
		app.use((req, res, next) => {
			if (req.method === "OPTIONS") {
				res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
				res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
				res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization");
				res.header("Access-Control-Allow-Credentials", "true");
				return res.sendStatus(204);
			}
			next();
		});
		app.use(express.json());

		server.listen(process.env.SERVER_PORT || 2003, () => {
			this.logger.info(`Server running on port ${process.env.SERVER_PORT || 2003}`);
		});

		return { server: app, wss };
	}

	initPlayerNet() {
		if (!process.env.MULTI_PLAYER_TOKEN) {
			useHooks.set("playerNetClient", [this.client]);
			return;
		}

		const playerNetTOKENs = process.env.MULTI_PLAYER_TOKEN.split(",");
		const playerNetClient = [this.client];
		try {
			playerNetTOKENs.forEach((TOKEN) => {
				const PlayerClient = new Client({
					intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
				});
				try {
					PlayerClient.login(TOKEN.trim());
					PlayerClient.once("ready", (cle) => {
						this.logger.info(`Connected to ${cle?.user?.displayName}`);
						playerNetClient.push(PlayerClient);
					});
				} catch (error) {
					this.logger.warn(`Failed to login with token: ${TOKEN.trim().slice(0, 22)}...`);
					this.logger.warn(error);
				}
			});
		} catch (e) {
			this.logger.warn("Create bot PlayerNet Fall:");
			this.logger.warn(e);
		} finally {
			useHooks.set("playerNetClient", playerNetClient);
		}
	}

	getConfig() {
		return this.config;
	}

	getLogger() {
		return this.logger;
	}

	createFile(directory) {
		const fs = require("node:fs");
		if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
	}

	initHooks() {
		useHooks.set("config", this.config);
		useHooks.set("client", this.client);
		useHooks.set("welcome", new Collection());
		useHooks.set("cooldowns", new Collection());
		useHooks.set("responder", new Collection());
		useHooks.set("temp", new Collection());
		useHooks.set("commands", new Collection());
		useHooks.set("Mcommands", new Collection());
		useHooks.set("functions", new Collection());
		useHooks.set("extensions", new Collection());
		useHooks.set("guildCommands", new Collection());
		useHooks.set("logger", this.logger);
		useHooks.set("wss", this.web.wss);
		useHooks.set("server", this.web.server);
		useHooks.set("icon", zzicon);
	}
}

const getAllowedOrigins = () => {
	const raw = process.env.CORS_ORIGIN;
	if (!raw || raw === "*") return "*";
	if (raw.includes(",")) return raw.split(",").map((origin) => origin.trim());
	return raw;
};

module.exports = { StartupManager };
