const { useHooks } = require("zihooks");
const client = useHooks.get("client");
const logger = useHooks.get("logger");
const { execFile } = require("child_process");

// Only allow harmless, read-only system commands.
// Do NOT allow shells/interpreters or commands capable of modifying the system.
const SAFE_COMMANDS = new Set([
	"ls",
	"pwd",
	"whoami",
	"uname",
	"df",
	"free",
	"uptime",
]);

const MAX_ARGS = 32;
const MAX_ARG_LENGTH = 256;
const EXEC_TIMEOUT = 10_000;
const MAX_BUFFER = 1024 * 1024;

// Graceful shutdown handler
let shuttingDown = false;

const shutdown = async (signal) => {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info(`Nhận tín hiệu ${signal}. Đang tắt bot...`);

	try {
		if (client && client.isReady()) {
			await client.destroy();
		}

		logger.info("Bot đã tắt an toàn.");
	} catch (err) {
		logger.error("Lỗi khi tắt bot:", err);
	} finally {
		process.exit(0);
	}
};

// Handle signals
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // kill / Docker stop

/**
 * Execute a safe system command.
 *
 * IMPORTANT:
 * - The executable is always hard-coded.
 * - User input is used only as arguments.
 * - execFile() does not invoke a shell.
 * - Dangerous executables such as sh, bash, node, python, rm, sudo, etc.
 *   are intentionally unavailable.
 */
const executeSafeCommand = (command, args) => {
	if (!SAFE_COMMANDS.has(command)) {
		console.log(`🚫 Lệnh "${command}" không được phép!`);
		return;
	}

	if (args.length > MAX_ARGS) {
		console.log(`🚫 Quá nhiều tham số! Tối đa ${MAX_ARGS} tham số.`);
		return;
	}

	for (const arg of args) {
		if (arg.length > MAX_ARG_LENGTH) {
			console.log(`🚫 Tham số quá dài! Tối đa ${MAX_ARG_LENGTH} ký tự.`);
			return;
		}

		// Prevent control characters from being passed to the child process.
		if (/[\u0000-\u001F\u007F]/.test(arg)) {
			console.log("🚫 Tham số chứa ký tự điều khiển không hợp lệ!");
			return;
		}
	}

	const options = {
		timeout: EXEC_TIMEOUT,
		maxBuffer: MAX_BUFFER,
		windowsHide: true,
	};

	// The executable passed to execFile() must remain a literal.
	switch (command) {
		case "ls":
			return execFile("ls", args, options, handleExecResult);

		case "pwd":
			return execFile("pwd", args, options, handleExecResult);

		case "whoami":
			return execFile("whoami", args, options, handleExecResult);

		case "uname":
			return execFile("uname", args, options, handleExecResult);

		case "df":
			return execFile("df", args, options, handleExecResult);

		case "free":
			return execFile("free", args, options, handleExecResult);

		case "uptime":
			return execFile("uptime", args, options, handleExecResult);

		default:
			// Should never be reached because of SAFE_COMMANDS.
			console.log(`🚫 Lệnh "${command}" không được phép!`);
	}
};

const handleExecResult = (error, stdout, stderr) => {
	if (error) {
		if (error.killed) {
			return console.error("❌ Lệnh đã bị timeout.");
		}

		return console.error(`❌ Lỗi: ${error.message}`);
	}

	if (stderr) {
		console.error(`⚠️ Cảnh báo: ${stderr}`);
	}

	console.log(`✅ Kết quả:\n${stdout}`);
};

module.exports = {
	name: "line",
	type: "console",
	enable: true,

	execute: async (input) => {
		if (typeof input !== "string") {
			logger.error("Console input không hợp lệ.");
			return;
		}

		const trimmedInput = input.trim();

		if (!trimmedInput) {
			return;
		}

		logger.debug(`CONSOLE issued bot command: ${trimmedInput}`);

		const args = trimmedInput.split(/\s+/);
		const command = args.shift()?.toLowerCase();

		if (!command) {
			return;
		}

		switch (command) {
			case "status":
			case "stat":
				logger.info(
					`Bot đang ${client.isReady() ? "hoạt động" : "tắt"}`,
				);
				break;

			case "update":
			case "up":
				logger.info("Update Starting...");
				useHooks
					.get("extensions")
					?.get("update")
					?.execute?.(true);
				break;

			case "stop":
			case "exit":
			case "quit":
				await shutdown("MANUAL");
				break;

			case "ping":
				logger.info(
					`Pong! Độ trễ của bot là ${client.ws.ping}ms`,
				);
				break;

			case "sh": {
				const execCmd = args.shift()?.toLowerCase();

				if (!execCmd) {
					return console.log(
						"❌ Vui lòng nhập lệnh hệ thống!",
					);
				}

				executeSafeCommand(execCmd, args);
				break;
			}

			case "help":
			case "h":
				logger.info(
					[
						"Danh sách các lệnh:",
						"- help",
						"- ping",
						"- stop",
						"- status",
						"- sh ls [args]",
						"- sh pwd",
						"- sh whoami",
						"- sh uname [args]",
						"- sh df [args]",
						"- sh free [args]",
						"- sh uptime",
					].join("\n"),
				);
				break;

			default:
				logger.error(`Lệnh không hợp lệ: ${command}`);
		}
	},
};
