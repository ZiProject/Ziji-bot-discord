const { useHooks } = require("zihooks");
const { table } = require("table");
const chalk = require("chalk");

module.exports.data = {
	name: "printLoaded",
	type: "extension",
	enable: true,
	priority: 1,
};

/**
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	const timeout = setTimeout(() => {
		console.clear();
		clearTimeout(timeout);

		let loaderOK = [];
		let loaderNG = [];

		const loaders = useHooks.get("loaders") || [];
		loaders.forEach((element) => {
			loaderOK.push(element?.result?.loaded || []);
			loaderNG.push(element?.result?.failed || []);
		});

		// Helper lấy độ dài mảng an toàn dưới dạng số
		const getLenNum = (arr, index) => arr?.at(index)?.length || 0;

		// Tính toán cho Commands (Loader index 4)
		const cmdOK = useHooks.get("commands")?.size || 0;
		const cmdFull = getLenNum(loaderOK, 4);
		const cmdDisabled = Math.max(0, cmdFull - cmdOK);

		// Tính toán cho Functions (Loader index 5)
		const fnOK = useHooks.get("functions")?.size || 0;
		const fnFull = getLenNum(loaderOK, 5);
		const fnDisabled = Math.max(0, fnFull - fnOK);

		// Tính toán cho Extensions (Loader index 6)
		const extOK = useHooks.get("extensions")?.size || 0;
		const extFull = getLenNum(loaderOK, 6);
		const extDisabled = Math.max(0, extFull - extOK);

		// Tính tổng cho events
		const eventsOKSum = String(
			(loaderOK[0]?.length || 0) + (loaderOK[1]?.length || 0) + (loaderOK[2]?.length || 0) + (loaderOK[3]?.length || 0),
		);
		const eventsNGSum = String(
			(loaderNG[0]?.length || 0) + (loaderNG[1]?.length || 0) + (loaderNG[2]?.length || 0) + (loaderNG[3]?.length || 0),
		);

		const tableData = [
			[chalk.hex("#E5C3FF")("name"), "OK", "full", "Disable", chalk.hex("#FF5733")("NG")],
			[chalk.hex("#E5C3FF")("events"), "-", eventsOKSum, "-", chalk.hex("#FF5733")(eventsNGSum)],
			[
				chalk.hex("#E5C3FF")("commands"),
				chalk.hex("#12f312")(String(cmdOK)),
				String(cmdFull),
				chalk.yellow(String(cmdDisabled)),
				chalk.hex("#FF5733")(String(getLenNum(loaderNG, 4))),
			],
			[
				chalk.hex("#E5C3FF")("functions"),
				chalk.hex("#12f312")(String(fnOK)),
				String(fnFull),
				chalk.yellow(String(fnDisabled)),
				chalk.hex("#FF5733")(String(getLenNum(loaderNG, 5))),
			],
			[
				chalk.hex("#E5C3FF")("extensions"),
				chalk.hex("#12f312")(String(extOK)),
				String(extFull),
				chalk.yellow(String(extDisabled)),
				chalk.hex("#FF5733")(String(getLenNum(loaderNG, 6))),
			],
			[chalk.hex("#E5C3FF")("welcome"), chalk.hex("#12f312")(String(useHooks.get("welcome")?.size || 0)), "-", "-", "-"],
			[chalk.hex("#E5C3FF")("cooldowns"), chalk.hex("#12f312")(String(useHooks.get("cooldowns")?.size || 0)), "-", "-", "-"],
			[chalk.hex("#E5C3FF")("responder"), chalk.hex("#12f312")(String(useHooks.get("responder")?.size || 0)), "-", "-", "-"],
			[
				chalk.hex("#E5C3FF")("guildCommands"),
				chalk.hex("#12f312")(String(useHooks.get("guildCommands")?.size || 0)),
				"-",
				"-",
				"-",
			],
		];

		const config = {
			header: {
				alignment: "center",
				content: client.user?.tag || "Bot Console",
			},
			columns: [
				{ width: 20 },
				{ width: 5, alignment: "center" },
				{ width: 5, alignment: "center" },
				{ width: 8, alignment: "center" },
				{ width: 5, alignment: "center" },
			],
			drawHorizontalLine: (lineIndex, rowCount) => {
				if (lineIndex === 0 || lineIndex === 1 || lineIndex === 2 || lineIndex === rowCount) return true;
				return false;
			},
		};
		console.log();
		console.log(table(tableData, config));
	}, 10000);
};
