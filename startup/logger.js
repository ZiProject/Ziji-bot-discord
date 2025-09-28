/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const winston = require("winston");
const util = require("util");
class LoggerFactory {
	constructor(config) {
		this.config = config;
	}

	create() {
		return useLogger(
			winston.createLogger({
				level: this.config?.DevConfig?.logger || "",
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.printf(({ level, message, timestamp }) => {
						const prefix = `[${timestamp}] [${level.toUpperCase()}]:`;
						return prefix + util.inspect(message, { showHidden: false, depth: 2, colors: true });
					}),
				),
				transports: [
					new winston.transports.Console({
						format: winston.format.printf(({ level, message }) => {
							const prefix = `[${level.toUpperCase()}]:`;
							return prefix + util.inspect(message, { showHidden: false, depth: 2, colors: true });
						}),
					}),
					new winston.transports.File({ filename: "./jsons/bot.log", level: "error" }),
				],
			}),
		);
	}

	static create(config) {
		return new LoggerFactory(config).create();
	}
}

module.exports = { LoggerFactory };
