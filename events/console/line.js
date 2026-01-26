const { useHooks } = require("zihooks");
const client = useHooks.get("client");
const logger = useHooks.get("logger");
const { exec } = require("child_process");
const blockedCommands = ["rm", "chmod", "sudo", "su", "reboot", "shutdown", "poweroff", "halt", "dd", "mkfs", "mount", "umount"];
module.exports = {
	name: "line",
	type: "console",
	enable: true,

	/**
	 * @param { String } input - console input
	 */
	execute: async (input) => {
		logger.debug(`CONSOLE issused bot command: ${input}`);
		const args = input.trim().split(/ +/);
		const command = args.shift().toLowerCase();
		switch (command) {
			case "status":
			case "stat":
				logger.info(`Bot đang ${client.isReady() ? "hoạt động" : "tắt"}`);
				break;
			case "update":
				logger.info(`Update Stating...`);
				useHooks.get("extensions")?.get("update")?.execute?.();
				break;
			case "stop":
			case "exit":
			case "quit":
				logger.info("Đang tắt bot...");
				client.destroy();
				process.exit(0);
				break;
			case "ping":
				logger.info(`Pong! Độ trễ của bot là ${client.ws.ping}ms`);
				break;
			case "sh":
				const cmd = args.join(" ");

				if (!cmd) return console.log("❌ Vui lòng nhập lệnh hệ thống!");
				if (blockedCommands.some((blocked) => cmd.includes(blocked)))
					return console.log(`🚫 Lệnh "${cmd}" bị cấm vì lý do bảo mật!`);

				exec(cmd, (error, stdout, stderr) => {
					if (error) return console.error(`❌ Lỗi: ${error.message}`);
					if (stderr) return console.error(`⚠️ Cảnh báo: ${stderr}`);
					console.log(`✅ Kết quả:\n${stdout}`);
				});
				break;
			case "help":
			case "h":
				logger.info(
					`Danh sách các lệnh:\n- help: Hiển thị trợ giúp\n- ping: Hiển thị độ trễ bot\n- stop: Tắt bot\n- status: Trả về trạng thái bot`,
				);
				break;
			default:
				logger.error(`Lệnh không hợp lệ: ${command}`);
		}
	},
};
