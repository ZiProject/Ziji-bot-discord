const { PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");
const { getBuilderSession, buildBuilderPreview } = require("./guildCommandBuilder");
const { validateComponentsLayout } = require("./guildCommandComponents");

const requireBuilderSession = async (interaction) => {
	if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
		await interaction.reply({ content: "Bạn cần quyền Administrator.", ephemeral: true });
		return null;
	}

	const session = getBuilderSession(interaction.user.id, interaction.guild.id);
	if (!session) {
		await interaction.reply({ content: "Phiên builder đã hết hạn. Chạy lại `/guildcommand builder`.", ephemeral: true });
		return null;
	}

	return session;
};

const refreshBuilderPreview = async (interaction, session) => {
	const payload = buildBuilderPreview(session, { user: interaction.user, guild: interaction.guild });
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

	const layoutCheck = validateComponentsLayout(session.layout);
	if (!layoutCheck.ok) {
		return interaction.reply({ content: layoutCheck.error, ephemeral: true });
	}

	const existing = await db.ZiGuildCommand.findOne({ guildId: session.guildId, name: session.commandName });
	if (existing) {
		existing.response = layoutCheck.value;
		await existing.save();
	} else {
		const { getGuildCommandCount, MAX_GUILD_COMMANDS, syncToCache, deployGuildCommands } = require("./guildCommandManager");
		const count = await getGuildCommandCount(session.guildId);
		if (count >= MAX_GUILD_COMMANDS) {
			return interaction.reply({ content: `Server đã đạt giới hạn ${MAX_GUILD_COMMANDS} lệnh.`, ephemeral: true });
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
		syncToCache(record);
		await deployGuildCommands(interaction.client, session.guildId);
		session.isNew = false;
		return interaction.reply({
			content: `Đã lưu lệnh mới \`/${record.name}\`.`,
			ephemeral: true,
		});
	}

	const { syncToCache, deployGuildCommands } = require("../../utils/guildCommandManager");
	syncToCache(existing);
	await deployGuildCommands(interaction.client, session.guildId);

	return interaction.reply({
		content: `Đã lưu layout cho \`/${existing.name}\`.`,
		ephemeral: true,
	});
};

module.exports = {
	getBuilderSession,
	requireBuilderSession,
	refreshBuilderPreview,
	saveBuilderSession,
};
