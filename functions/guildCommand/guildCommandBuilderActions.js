const { PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");

const requireBuilderSession = async (interaction) => {
	if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
		await interaction.reply({ content: "Bạn cần quyền Administrator.", ephemeral: true });
		return null;
	}

	const functions = useHooks.get("functions");
	const builder = functions?.get("guildCommandBuilder");
	const session = await builder?.execute({
		action: "getBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
	});
	if (!session) {
		await interaction.reply({ content: "Phiên builder đã hết hạn. Chạy lại `/guildcommand builder`.", ephemeral: true });
		return null;
	}

	return session;
};

const refreshBuilderPreview = async (interaction, session) => {
	const functions = useHooks.get("functions");
	const builder = functions?.get("guildCommandBuilder");
	const payload = await builder?.execute({
		action: "buildBuilderPreview",
		session,
		context: { user: interaction.user, guild: interaction.guild },
	});
	if (interaction.isModalSubmit()) {
		return interaction.reply(payload);
	}
	if (interaction.deferred || interaction.replied) {
		return interaction.editReply(payload);
	}
	return interaction.update(payload);
};

const saveBuilderSession = async (interaction, session) => {
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand) {
		return interaction.reply({ content: "Database không khả dụng.", ephemeral: true });
	}

	const functions = useHooks.get("functions");
	const builder = functions?.get("guildCommandBuilder");
	const components = functions?.get("guildCommandComponents");
	const manager = functions?.get("guildCommandManager");
	const layoutCheck = await components?.execute({
		action: "validateComponentsLayout",
		layout: session.layout,
	});
	if (!layoutCheck.ok) {
		return interaction.reply({ content: layoutCheck.error, ephemeral: true });
	}

	const existing = await db.ZiGuildCommand.findOne({ guildId: session.guildId, name: session.commandName });
	if (existing) {
		existing.response = layoutCheck.value;
		await existing.save();
	} else {
		const count = await manager?.execute({ action: "getGuildCommandCount", guildId: session.guildId });
		if (count >= manager.MAX_GUILD_COMMANDS) {
			return interaction.reply({ content: `Server đã đạt giới hạn ${manager.MAX_GUILD_COMMANDS} lệnh.`, ephemeral: true });
		}

		const record = await db.ZiGuildCommand.create({
			guildId: session.guildId,
			name: session.commandName,
			description: session.pendingDescription || "Lệnh Components V2",
			type: "components",
			response: layoutCheck.value,
			target: null,
			enabled: true,
			createdBy: interaction.user.id,
		});
		await manager?.execute({ action: "syncToCache", record });
		await manager?.execute({ action: "deployGuildCommands", client: interaction.client, guildId: session.guildId });
		session.isNew = false;
		return interaction.reply({
			content: `Đã lưu lệnh mới \`/${record.name}\`.`,
			ephemeral: true,
		});
	}

	await manager?.execute({ action: "syncToCache", record: existing });
	await manager?.execute({ action: "deployGuildCommands", client: interaction.client, guildId: session.guildId });

	return interaction.reply({
		content: `Đã lưu layout cho \`/${existing.name}\`.`,
		ephemeral: true,
	});
};

module.exports = {
	requireBuilderSession,
	refreshBuilderPreview,
	saveBuilderSession,
	data: { name: "guildCommandBuilderActions", type: "guildCommand", enable: true },
};

module.exports.execute = async ({ action = "api", ...payload } = {}) => {
	switch (action) {
		case "requireBuilderSession":
			return requireBuilderSession(payload.interaction);
		case "refreshBuilderPreview":
			return refreshBuilderPreview(payload.interaction, payload.session);
		case "saveBuilderSession":
			return saveBuilderSession(payload.interaction, payload.session);
		case "api":
		default:
			return this;
	}
};
