const { REST, Routes } = require("discord.js");
const { useHooks } = require("zihooks");
const { buildSlashData } = require("../utils/guildCommandManager");

module.exports = async (client) => {
	const config = useHooks.get("config");
	const commands = { global: [], owner: [] };

	await Promise.all(
		useHooks.get("commands").map(async (command) => {
			commands[command.data.owner ? "owner" : "global"].push(command.data);
		}),
	).catch((e) => useHooks.get("logger")?.info?.(`Error reloaded commands:\n ${e}`));

	const rest = new REST().setToken(process.env.TOKEN);

	const deployCommands = async (commandType, route, body) => {
		if (body.length > 0) {
			await rest.put(route, { body });
			client?.errorLog?.(`Successfully reloaded ${body.length} ${commandType} application [/] commands.`);
			useHooks
				.get("logger")
				?.info?.(`Successfully reloaded ${body.length} ${commandType} application [/] commands.`);
		}
	};

	const getGuildCustomCommands = async (guildId) => {
		const db = useHooks.get("db");
		if (!db?.ZiGuildCommand) return [];
		const records = await db.ZiGuildCommand.find({ guildId, enabled: true });
		return records.map(buildSlashData);
	};

	try {
		await deployCommands("global", Routes.applicationCommands(client.user.id), commands.global);

		const guildIds = config?.DevGuild || [];
		const devGuildSet = new Set(guildIds);

		if (guildIds.length > 0) {
			await Promise.all(
				guildIds.map(async (guildId) => {
					const customCommands = await getGuildCustomCommands(guildId);
					const body = [...commands.owner, ...customCommands];
					if (body.length > 0) {
						await deployCommands("owner", Routes.applicationGuildCommands(client.user.id, guildId), body);
					}
				}),
			);
		}

		const db = useHooks.get("db");
		if (db?.ZiGuildCommand) {
			const allCustom = await db.ZiGuildCommand.find({ enabled: true });
			const grouped = new Map();
			for (const record of allCustom) {
				if (devGuildSet.has(record.guildId)) continue;
				if (!grouped.has(record.guildId)) grouped.set(record.guildId, []);
				grouped.get(record.guildId).push(buildSlashData(record));
			}

			await Promise.all(
				[...grouped.entries()].map(([guildId, body]) =>
					deployCommands("guild-custom", Routes.applicationGuildCommands(client.user.id, guildId), body),
				),
			);
		}
	} catch (error) {
		console.error("Error during command deployment:", error);
	}
};
