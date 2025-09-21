const { table } = require("table");
const fsPromises = require("fs").promises;
const fs = require("fs");
const chalk = require("chalk");
const path = require("node:path");
const { useConfig } = require("@zibot/zihooks");

class StartupLoader {
	constructor(config = useConfig(), logger = console) {
		this.config = config;
		this.logger = logger;
	}

	async loadFiles(directory, collection) {
		try {
			const folders = await fsPromises.readdir(directory);
			const clientCommands = [];

			await Promise.all(
				folders.map(async (folder) => {
					const folderPath = path.join(directory, folder);
					const files = await fsPromises.readdir(folderPath).then((items) => items.filter((file) => file.endsWith(".js")));

					await Promise.all(
						files.map(async (file) => {
							const filePath = path.join(folderPath, file);

							try {
								const module = require(path.resolve(filePath));
								const disabledCommands = this.config?.disabledCommands ?? [];
								const isDisabled = disabledCommands.includes(module?.data?.name) || module?.data?.enable === false;

								if ("data" in module && "execute" in module) {
									clientCommands.push([
										chalk.hex(isDisabled ? "#4733FF" : "#E5C3FF")(module.data.name),
										isDisabled ? "No" : "Yes",
									]);

									if (!isDisabled && collection) {
										collection.set(module.data.name, module);
									}
								} else {
									clientCommands.push([chalk.hex("#FF5733")(file), "No"]);
									this.log("warn", `Module from ${file} is missing 'data' or 'execute' property.`);
								}
							} catch (moduleError) {
								clientCommands.push([chalk.hex("#FF5733")(file), "No"]);
								this.log("error", `Error loading command from file ${file}:`, moduleError);
							}
						}),
					);
				}),
			);

			this.printTable(clientCommands, path.basename(directory));
		} catch (dirError) {
			this.log("error", `Error reading directory ${directory}:`, dirError);
		}
	}

	async loadEvents(directory, target) {
		const clientEvents = [];
		const traverse = async (dir) => {
			const files = await fsPromises.readdir(dir, { withFileTypes: true });

			await Promise.all(
				files.map(async (file) => {
					const filePath = path.join(dir, file.name);

					if (file.isDirectory()) {
						await traverse(filePath);
						return;
					}

					if (!file.isFile() || !file.name.endsWith(".js")) {
						return;
					}

					try {
						const event = require(path.resolve(filePath));
						const isDisabled = event?.enable === false;

						clientEvents.push([
							chalk.hex(isDisabled ? "#4733FF" : "#E5C3FF")(event?.name ?? file.name),
							isDisabled ? "No" : "Yes",
						]);

						if (isDisabled) {
							return;
						}

						const handler = async (...args) => {
							try {
								await event.execute(...args);
							} catch (executeError) {
								this.log("error", `Error executing event ${event.name}:`, executeError);
							}
						};

						target[event.once ? "once" : "on"](event.name, handler);
					} catch (loadError) {
						clientEvents.push([chalk.hex("#FF5733")(file.name), "No"]);
						this.log("error", `Error loading event from file ${file.name}:`, loadError);
					}
				}),
			);
		};

		await traverse(directory);
		this.printTable(clientEvents, `Events ${path.basename(directory)}`);
	}

	createDirectory(dir) {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	printTable(rows, title) {
		this.log(
			"log",
			table(rows, {
				header: {
					alignment: "center",
					content: title,
				},
				singleLine: true,
				columns: [{ width: 25 }, { width: 5, alignment: "center" }],
			}),
		);
	}

	log(level, ...args) {
		// if (this.logger && typeof this.logger[level] === "function") {
		// 	this.logger[level](...args);
		// 	return;
		// }

		if (typeof console[level] === "function") {
			console[level](...args);
			return;
		}

		console.log(...args);
	}
}

module.exports = { StartupLoader };
