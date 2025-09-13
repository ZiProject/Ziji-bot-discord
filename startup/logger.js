// Configure logger
const winston = require("winston");
const util = require("util");
const { useLogger } = require("@zibot/zihooks");

function logf(config) {
	return useLogger(
		winston.createLogger({
			level: config?.DevConfig?.logger || "",
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.printf(
					({ level, message, timestamp }) =>
						`[${timestamp}] [${level.toUpperCase()}]:` + util.inspect(message, { showHidden: false, depth: 2, colors: true }),
				),
			),
			transports: [
				new winston.transports.Console({
					format: winston.format.printf(
						({ level, message }) =>
							`[${level.toUpperCase()}]:` + util.inspect(message, { showHidden: false, depth: 2, colors: true }),
					),
				}),
				new winston.transports.File({ filename: "./jsons/bot.log", level: "error" }),
			],
		}),
	);
}
module.exports = { logf };
