const { useHooks } = require("zihooks");
const client = useHooks.get("client");
const logger = useHooks.get("logger");
const { exec } = require("child_process");

const blockedCommands = ["rm", "chmod", "sudo", "su", "reboot", "shutdown", "poweroff", "halt", "dd", "mkfs", "mount", "umount"];

// ✅ Graceful shutdown handler
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

// ✅ Handle signals
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // kill / Docker stop

module.exports = {
	name: "line",
	type: "console",
	enable: true,

	execute: async (input) => {
		logger.debug(`CONSOLE issued bot command: ${input}`);
		const args = input.trim().split(/ +/);
		const command = args.shift().toLowerCase();

		switch (command) {
			case "status":
			case "stat":
				logger.info(`Bot đang ${client.isReady() ? "hoạt động" : "tắt"}`);
				break;

			case "update":
			case "up":
				logger.info(`Update Starting...`);
				useHooks.get("extensions")?.get("update")?.execute?.(true);
				break;

			case "stop":
			case "exit":
			case "quit":
				await shutdown("MANUAL");
				break;

			case "ping":
				logger.info(`Pong! Độ trễ của bot là ${client.ws.ping}ms`);
				break;

			case "sh":
				const cmd = args.join(" ");

				if (!cmd) return console.log("❌ Vui lòng nhập lệnh hệ thống!");
				if (blockedCommands.some((b) => cmd.includes(b))) return console.log(`🚫 Lệnh "${cmd}" bị cấm vì lý do bảo mật!`);

				exec(cmd, (error, stdout, stderr) => {
					if (error) return console.error(`❌ Lỗi: ${error.message}`);
					if (stderr) return console.error(`⚠️ Cảnh báo: ${stderr}`);
					console.log(`✅ Kết quả:\n${stdout}`);
				});
				break;

			case "help":
			case "h":
				logger.info(`Danh sách các lệnh:\n- help\n- ping\n- stop\n- status`);
				break;

			default:
				logger.error(`Lệnh không hợp lệ: ${command}`);
		}
	},
};
