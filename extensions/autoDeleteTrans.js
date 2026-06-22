const { useHooks } = require("zihooks");
const fs = require("fs");
const cron = require("node-cron");
const path = require("node:path");
const TARGET_DIR = path.join(__dirname, "../transcripts");
const EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000;
module.exports.data = {
	name: "autoDeleteTranscripts",
	type: "extension",
	enable: useHooks.get("config").DevConfig.ticket ? true : false,
    //enable: true,
};
function cleanOldFiles() {
	console.log(`[${new Date().toLocaleString()}] Bắt đầu quét thư mục dọn dẹp...`);
	if (!fs.existsSync(TARGET_DIR)) {
		console.log("Thư mục mục tiêu không tồn tại.");
		return;
	}
	fs.readdir(TARGET_DIR, (err, files) => {
		if (err) {
			console.error("Lỗi khi đọc thư mục:", err);
			return;
		}
		const now = Date.now();
		files.forEach((file) => {
			const filePath = path.join(TARGET_DIR, file);
			fs.stat(filePath, (err, stats) => {
				if (err) {
					console.error(`Không thể lấy thông tin file ${file}:`, err);
					return;
				}
				if (stats.isFile()) {
					const fileAge = now - stats.mtime.getTime();
					if (fileAge > EXPIRE_TIME) {
						fs.unlink(filePath, (err) => {
							if (err) {
								console.error(`Lỗi khi xóa file ${file}:`, err);
							} else {
								console.log(` Đã xóa file cũ: ${file}`);
							}
						});
					}
				}
			});
		});
	});
}

module.exports.execute = async () => {
    useHooks.get("logger")?.info?.("Starting autoDeleteTranscripts...");
    cron.schedule("0 0 * * *", () => {
	    cleanOldFiles();
    }); 
}