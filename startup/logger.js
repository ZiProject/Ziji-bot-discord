const winston = require("winston");
const util = require("util");

class LoggerFactory {
	constructor(config) {
		this.config = config;
	}

	create() {
		const customFormat = (includeTimestamp = true) =>
			winston.format.printf((info) => {
				const { level, message, timestamp, ...meta } = info;

				const cleanMeta = Object.keys(meta)
					.filter((key) => typeof key !== "symbol")
					.reduce((acc, key) => {
						acc[key] = meta[key];
						return acc;
					}, {});

				const prefix = includeTimestamp && timestamp ? `[${timestamp}] [${level.toUpperCase()}]:` : `[${level.toUpperCase()}]:`;

				const msgString =
					typeof message === "string" ? message : util.inspect(message, { showHidden: false, depth: 4, colors: true });

				const metaString =
					Object.keys(cleanMeta).length > 0 ? " " + util.inspect(cleanMeta, { showHidden: false, depth: 4, colors: true }) : "";

				return `${prefix} ${msgString}${metaString}`;
			});

		return winston.createLogger({
			level: this.config?.DevConfig?.logger || "info",
			transports: [
				new winston.transports.Console({
					format: winston.format.combine(winston.format.splat(), customFormat(false)),
				}),
				new winston.transports.File({
					filename: "./jsons/bot.log",
					level: "error",
					format: winston.format.combine(winston.format.timestamp(), winston.format.splat(), customFormat(true)),
				}),
			],
		});
	}

	static create(config) {
		return new LoggerFactory(config).create();
	}
}

module.exports = { LoggerFactory };
