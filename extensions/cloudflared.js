const { useHooks } = require("zihooks");
const { bin, install } = require("cloudflared");
const { spawn } = require("node:child_process");
const fs = require("fs");

module.exports.data = {
	name: "Cloudflared",
	type: "extension",
	enable: true,
};

module.exports.execute = async (client) => {
	if (!useHooks.get("config")?.webAppConfig?.enabled) return;
	if (!process.env.CloudflaredToken) return;
	if (process.env.CloudflaredToken == "") return;

	if (!fs.existsSync(bin)) {
		await install(bin);
	}
	spawn(bin, ["tunnel", "run", "--token", process.env.CloudflaredToken], { stdio: "inherit" });
};
