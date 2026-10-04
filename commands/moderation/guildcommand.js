const { PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");

const getGuildHelpers = () => {
	const functions = useHooks.get("functions");
	return {
		manager: functions?.get("guildCommandManager"),
		components: functions?.get("guildCommandComponents"),
		builder: functions?.get("guildCommandBuilder"),
	};
};

module.exports.data = {
	name: "guildcommand",
	description: "Tạo hoặc sửa lệnh chuyên sâu bằng trình dựng web",
	type: 1,
	options: [{ name: "name", description: "Tên lệnh cần tạo hoặc sửa", type: 3, required: true }],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: String(PermissionsBitField.Flags.Administrator),
	ephemeral: true,
	enable: config?.DevConfig?.GuildCommand !== false,
};

const requireAdmin = (interaction, lang) => {
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
		interaction.reply({ content: lang.until.noPermission, ephemeral: true });
		return false;
	}
	return true;
};

module.exports.execute = async ({ interaction, lang }) => {
	if (!requireAdmin(interaction, lang)) return;
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand)
		return interaction.reply({ content: lang?.until?.noDB || "Database không khả dụng.", ephemeral: true });
	await interaction.deferReply({ ephemeral: true });
	const manager = getGuildHelpers().manager;
	const checked = await manager.execute({ action: "validateCommandName", name: interaction.options.getString("name") });
	if (!checked.ok) return interaction.editReply(checked.error);
	const record = await db.ZiGuildCommand.findOne({ guildId: interaction.guildId, name: checked.value });
	const session = useHooks.get("functions")?.get("guildCommandWeb");
	if (!session) return interaction.editReply("Trình dựng web chưa sẵn sàng.");
	const result = session.createSession({ guildId: interaction.guildId, name: checked.value, userId: interaction.user.id });
	const base = process.env.API_URL || `http://localhost:${process.env.SERVER_PORT | 2003}`;
	return interaction.editReply(
		`${record ? "Mở trình sửa" : "Mở trình tạo"} lệnh \`/${checked.value}\`:\n${base}/guildcommand/editor?token=${encodeURIComponent(result.token)}\nNhập mật khẩu sau khi mở editor (hết hạn sau 24 giờ): \`${result.password}\``,
	);
};

module.exports.create = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager } = getGuildHelpers();
	const nameCheck = await manager?.execute({
		action: "validateCommandName",
		name: interaction.options.getString("name"),
	});
	if (!nameCheck.ok) return interaction.editReply(nameCheck.error);

	const descCheck = await manager?.execute({
		action: "validateDescription",
		description: interaction.options.getString("description"),
	});
	if (!descCheck.ok) return interaction.editReply(descCheck.error);

	const type = interaction.options.getString("type");
	const payloadCheck = await manager?.execute({
		action: "validateResponsePayload",
		type,
		payload: {
			content: interaction.options.getString("content"),
			layout: interaction.options.getString("content"),
			title: interaction.options.getString("title"),
			description: interaction.options.getString("embed_description"),
			color: interaction.options.getString("color"),
			target: interaction.options.getString("target"),
		},
	});
	if (!payloadCheck.ok) return interaction.editReply(payloadCheck.error);

	const existing = await db.ZiGuildCommand.findOne({ guildId: interaction.guild.id, name: nameCheck.value });
	if (existing) {
		return interaction.editReply(`Lệnh \`${nameCheck.value}\` đã tồn tại. Dùng \`/guildcommand edit\` hoặc \`builder\` để sửa.`);
	}

	const count = await manager?.execute({ action: "getGuildCommandCount", guildId: interaction.guild.id });
	if (count >= manager.MAX_GUILD_COMMANDS) {
		return interaction.editReply(`Server đã đạt giới hạn ${manager.MAX_GUILD_COMMANDS} lệnh chuyên sâu.`);
	}

	const record = await db.ZiGuildCommand.create({
		guildId: interaction.guild.id,
		name: nameCheck.value,
		description: descCheck.value,
		type,
		response:
			type === "proxy" ? payloadCheck.value.proxyMeta
			: type === "components" ? payloadCheck.value
			: payloadCheck.value,
		target: type === "proxy" ? payloadCheck.value.target : null,
		enabled: true,
		createdBy: interaction.user.id,
	});

	syncToCache(record);
	await deployGuildCommands(interaction.client, interaction.guild.id);

	const proxyHint =
		type === "proxy" && payloadCheck.value.proxyMeta?.subcommand ?
			` → \`${record.target}:${payloadCheck.value.proxyMeta.subcommandGroup ? `${payloadCheck.value.proxyMeta.subcommandGroup}:` : ""}${payloadCheck.value.proxyMeta.subcommand}\``
		:	"";

	return interaction.editReply(`Đã tạo lệnh chuyên sâu \`/${record.name}\` (${type}${proxyHint}).`);
};

module.exports.edit = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager } = getGuildHelpers();
	const name = interaction.options.getString("name").toLowerCase();
	const record = await db.ZiGuildCommand.findOne({ guildId: interaction.guild.id, name });
	if (!record) return interaction.editReply(`Không tìm thấy lệnh \`${name}\`.`);

	const newDescription = interaction.options.getString("description");
	if (newDescription) {
		const descCheck = await manager?.execute({
			action: "validateDescription",
			description: newDescription,
		});
		if (!descCheck.ok) return interaction.editReply(descCheck.error);
		record.description = descCheck.value;
	}

	if (record.type === "text") {
		const content = interaction.options.getString("content");
		if (content) {
			const payloadCheck = await manager?.execute({ action: "validateResponsePayload", type: "text", payload: { content } });
			if (!payloadCheck.ok) return interaction.editReply(payloadCheck.error);
			record.response = payloadCheck.value;
		}
	}

	if (record.type === "embed") {
		const payloadCheck = await manager?.execute({
			action: "validateResponsePayload",
			type: "embed",
			payload: {
				title: interaction.options.getString("title") ?? record.response?.embed?.title,
				description: interaction.options.getString("embed_description") ?? record.response?.embed?.description,
				color: interaction.options.getString("color") ?? record.response?.embed?.color,
				image: record.response?.embed?.image,
				thumbnail: record.response?.embed?.thumbnail,
			},
		});
		if (!payloadCheck.ok) return interaction.editReply(payloadCheck.error);
		record.response = payloadCheck.value;
	}

	if (record.type === "components") {
		const layout = interaction.options.getString("content");
		if (layout) {
			const payloadCheck = await manager?.execute({
				action: "validateResponsePayload",
				type: "components",
				payload: { layout },
			});
			if (!payloadCheck.ok) return interaction.editReply(payloadCheck.error);
			record.response = payloadCheck.value;
		}
	}

	await record.save();
	await manager?.execute({ action: "syncToCache", record });
	await manager?.execute({ action: "deployGuildCommands", client: interaction.client, guildId: interaction.guild.id });

	return interaction.editReply(`Đã cập nhật lệnh chuyên sâu \`/${record.name}\`.`);
};

module.exports.builder = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager, builder, components } = getGuildHelpers();
	const name = interaction.options.getString("name").toLowerCase();
	const nameCheck = await manager?.execute({ action: "validateCommandName", name });
	if (!nameCheck.ok) return interaction.editReply(nameCheck.error);

	const existing = await db.ZiGuildCommand.findOne({ guildId: interaction.guild.id, name: nameCheck.value });
	const description = interaction.options.getString("description");

	if (!existing) {
		const descCheck = await manager?.execute({
			action: "validateDescription",
			description: description || "Lệnh Components V2",
		});
		if (!descCheck.ok) return interaction.editReply(descCheck.error);

		const count = await manager?.execute({ action: "getGuildCommandCount", guildId: interaction.guild.id });
		if (count >= manager.MAX_GUILD_COMMANDS) {
			return interaction.editReply(`Server đã đạt giới hạn ${manager.MAX_GUILD_COMMANDS} lệnh chuyên sâu.`);
		}

		const session = await builder?.execute({
			action: "startBuilderSession",
			userId: interaction.user.id,
			guildId: interaction.guild.id,
			commandName: nameCheck.value,
			isNew: true,
			layout: null,
		});
		session.pendingDescription = descCheck.value;
		await builder?.execute({
			action: "setBuilderSession",
			userId: interaction.user.id,
			guildId: interaction.guild.id,
			session,
		});
		return interaction.editReply(
			await builder?.execute({
				action: "buildBuilderPreview",
				session,
				context: { user: interaction.user, guild: interaction.guild },
			}),
		);
	}

	if (existing.type !== "components") {
		return interaction.editReply(`Lệnh \`${nameCheck.value}\` không phải loại components. Dùng \`/guildcommand edit\`.`);
	}

	const layoutCheck = await components?.execute({
		action: "parseComponentsLayout",
		raw: existing.response,
	});
	const session = await builder?.execute({
		action: "startBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
		commandName: nameCheck.value,
		layout: layoutCheck.ok ? layoutCheck.value : undefined,
		isNew: false,
	});

	return interaction.editReply(
		await builder?.execute({
			action: "buildBuilderPreview",
			session,
			context: { user: interaction.user, guild: interaction.guild },
		}),
	);
};

module.exports.preview = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager, components } = getGuildHelpers();
	const name = interaction.options.getString("name").toLowerCase();
	const record = await db.ZiGuildCommand.findOne({ guildId: interaction.guild.id, name });
	if (!record) return interaction.editReply(`Không tìm thấy lệnh \`${name}\`.`);

	if (record.type === "components") {
		const layoutCheck = await components?.execute({
			action: "parseComponentsLayout",
			raw: record.response,
		});
		if (!layoutCheck.ok) return interaction.editReply(layoutCheck.error);
		return interaction.editReply(
			await components?.execute({
				action: "buildComponentsReply",
				layout: layoutCheck.value,
				context: { user: interaction.user, guild: interaction.guild },
			}),
		);
	}

	if (record.type === "text") {
		return interaction.editReply({ content: record.response?.content || "(trống)" });
	}

	if (record.type === "embed") {
		const { EmbedBuilder } = require("discord.js");
		const embedData = record.response?.embed || {};
		const embed = new EmbedBuilder();
		if (embedData.title) embed.setTitle(embedData.title);
		if (embedData.description) embed.setDescription(embedData.description);
		if (embedData.color) embed.setColor(embedData.color);
		return interaction.editReply({ embeds: [embed] });
	}

	if (record.type === "proxy") {
		const sub = record.response?.subcommand;
		const group = record.response?.subcommandGroup;
		const targetLabel =
			group ? `${record.target}:${group}:${sub}`
			: sub ? `${record.target}:${sub}`
			: record.target;
		return interaction.editReply(`Proxy → \`${targetLabel}\`\nChạy \`/${record.name}\` để kiểm tra thực tế.`);
	}

	return interaction.editReply("Không thể preview loại lệnh này.");
};

module.exports.delete = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager } = getGuildHelpers();
	const name = interaction.options.getString("name").toLowerCase();
	const record = await db.ZiGuildCommand.findOne({ guildId: interaction.guild.id, name });
	if (!record) return interaction.editReply(`Không tìm thấy lệnh \`${name}\`.`);

	await db.ZiGuildCommand.deleteOne({ guildId: interaction.guild.id, name });
	await manager?.execute({ action: "removeFromCache", guildId: interaction.guild.id, name });
	await manager?.execute({ action: "deployGuildCommands", client: interaction.client, guildId: interaction.guild.id });

	return interaction.editReply(`Đã xóa lệnh chuyên sâu \`/${name}\`.`);
};

module.exports.list = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	const { manager } = getGuildHelpers();
	const records = await db.ZiGuildCommand.find({ guildId: interaction.guild.id, enabled: true });
	if (!records.length) {
		return interaction.editReply("Server chưa có lệnh chuyên sâu nào.");
	}

	const lines = records.map((record) => {
		let extra = "";
		if (record.type === "proxy" && record.response?.subcommand) {
			extra = ` → ${record.target}:${record.response.subcommandGroup ? `${record.response.subcommandGroup}:` : ""}${record.response.subcommand}`;
		}
		return `- \`/${record.name}\` — ${record.description} (${record.type}${extra})`;
	});
	return interaction.editReply(`**Lệnh chuyên sâu (${records.length}/${manager.MAX_GUILD_COMMANDS}):**\n${lines.join("\n")}`);
};

module.exports.autocomplete = async ({ interaction }) => {
	const { manager } = getGuildHelpers();
	const focused = interaction.options.getFocused(true);
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand) return;

	if (focused.name === "name") {
		const records = await db.ZiGuildCommand.find({ guildId: interaction.guild.id, enabled: true });
		const filtered = records
			.filter((record) => record.name.startsWith(focused.value.toLowerCase()))
			.slice(0, 25)
			.map((record) => ({ name: record.name, value: record.name }));
		return interaction.respond(filtered);
	}

	if (focused.name === "target") {
		const query = focused.value.toLowerCase();
		const choices = [];

		for (const cmd of useHooks.get("commands").values()) {
			if (cmd.data?.owner || cmd.data?.enable === false || cmd.data?.lock || cmd.data?.ckeckVoice) continue;
			if (cmd.data?.category === "musix") continue;

			const labels = await manager?.execute({ action: "formatProxyTargetLabel", commandData: cmd.data });
			if (!labels.length) {
				if (cmd.data.name.startsWith(query)) {
					choices.push({ name: cmd.data.name, value: cmd.data.name });
				}
				continue;
			}

			for (const label of labels) {
				if (label.startsWith(query)) choices.push({ name: label, value: label });
			}
		}

		return interaction.respond(choices.slice(0, 25));
	}
};
