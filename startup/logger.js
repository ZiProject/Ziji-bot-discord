const winston = require("winston");
const util = require("util");

class LoggerFactory {
	constructor(config) {
		this.config = config;
	}

	create() {
		return winston.createLogger({
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
		});
	}

	static create(config) {
		return new LoggerFactory(config).create();
	}
}

module.exports = { LoggerFactory };
