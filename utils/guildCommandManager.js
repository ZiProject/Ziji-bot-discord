const { EmbedBuilder, REST, Routes } = require("discord.js");
const { ApplicationCommandOptionType } = require("discord-api-types/v10");
const { useHooks } = require("zihooks");
const { parseComponentsLayout, buildComponentsReply } = require("./guildCommandComponents");

const CommandInteractionOptionResolver = require("discord.js/src/structures/CommandInteractionOptionResolver");

const MAX_GUILD_COMMANDS = 25;
const MAX_NAME_LENGTH = 32;
const MAX_DESC_LENGTH = 100;
const MAX_CONTENT_LENGTH = 2000;
const MAX_EMBED_FIELD_LENGTH = 4096;
const COMMAND_NAME_PATTERN = /^[\da-z-]{1,32}$/;

const BLOCKED_COMMAND_NAMES = new Set([
	"eval",
	"exec",
	"run",
	"shell",
	"system",
	"admin",
	"owner",
	"dev-ban",
	"dev-unban",
	"shutdown",
	"add-coin",
	"remove-coin",
]);

const ALLOWED_TYPES = new Set(["text", "embed", "proxy", "components"]);
const SAFE_URL_PATTERN = /^https?:\/\//i;

const cacheKey = (guildId, name) => `${guildId}:${name.toLowerCase()}`;

const getReservedNames = () => {
	const names = new Set(BLOCKED_COMMAND_NAMES);
	for (const cmd of useHooks.get("commands")?.values() || []) {
		if (cmd?.data?.name) names.add(cmd.data.name.toLowerCase());
	}
	return names;
};

const sanitizeText = (value, maxLength) => {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, maxLength);
};

const isSafeUrl = (url) => typeof url === "string" && SAFE_URL_PATTERN.test(url.trim());

const commandHasSubcommands = (commandData) =>
	(commandData?.options || []).some((option) => option.type === 1 || option.type === 2);

const parseProxyTarget = (rawTarget) => {
	const normalized = sanitizeText(rawTarget, MAX_NAME_LENGTH * 3)
		.toLowerCase()
		.replaceAll(" ", "");
	if (!normalized) return null;

	const parts = normalized.split(/[/:]/).filter(Boolean);
	if (!parts.length) return null;

	return {
		command: parts[0],
		subcommandGroup: parts.length >= 3 ? parts[1] : null,
		subcommand: parts.length >= 3 ? parts[2] : parts.length === 2 ? parts[1] : null,
	};
};

const resolveSubcommandDefinition = (commandData, subcommandGroup, subcommand) => {
	const options = commandData?.options || [];
	if (subcommandGroup) {
		const group = options.find((option) => option.type === 2 && option.name === subcommandGroup);
		if (!group) return null;
		return (group.options || []).find((option) => option.type === 1 && option.name === subcommand) || null;
	}
	if (subcommand) {
		return options.find((option) => option.type === 1 && option.name === subcommand) || null;
	}
	return null;
};

const readOptionValue = (options, def) => {
	switch (def.type) {
		case ApplicationCommandOptionType.String:
			return options.getString(def.name, false);
		case ApplicationCommandOptionType.Integer:
			return options.getInteger(def.name, false);
		case ApplicationCommandOptionType.Number:
			return options.getNumber(def.name, false);
		case ApplicationCommandOptionType.Boolean:
			return options.getBoolean(def.name, false);
		case ApplicationCommandOptionType.User:
			return options.getUser(def.name, false);
		case ApplicationCommandOptionType.Channel:
			return options.getChannel(def.name, false);
		case ApplicationCommandOptionType.Role:
			return options.getRole(def.name, false);
		case ApplicationCommandOptionType.Mentionable:
			return options.getMentionable(def.name, false);
		case ApplicationCommandOptionType.Attachment:
			return options.getAttachment(def.name, false);
		default:
			return null;
	}
};

const buildOptionPayload = (def, value) => {
	if (value === null || value === undefined) return null;
	const payload = { name: def.name, type: def.type };
	switch (def.type) {
		case ApplicationCommandOptionType.String:
		case ApplicationCommandOptionType.Integer:
		case ApplicationCommandOptionType.Number:
		case ApplicationCommandOptionType.Boolean:
			payload.value = value;
			break;
		case ApplicationCommandOptionType.User:
		case ApplicationCommandOptionType.Channel:
		case ApplicationCommandOptionType.Role:
		case ApplicationCommandOptionType.Mentionable:
			payload.value = value.id;
			break;
		case ApplicationCommandOptionType.Attachment:
			payload.value = value.id;
			break;
		default:
			return null;
	}
	return payload;
};

const buildProxyOptionData = (interaction, subcommand, subcommandGroup, optionDefs = []) => {
	if (!subcommand) return interaction.options.data;

	const subOptions = optionDefs
		.map((def) => buildOptionPayload(def, readOptionValue(interaction.options, def)))
		.filter(Boolean);

	if (subcommandGroup) {
		return [
			{
				type: ApplicationCommandOptionType.SubcommandGroup,
				name: subcommandGroup,
				options: [
					{
						type: ApplicationCommandOptionType.Subcommand,
						name: subcommand,
						options: subOptions,
					},
				],
			},
		];
	}

	return [
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: subcommand,
			options: subOptions,
		},
	];
};

const createProxyInteraction = (interaction, { commandName, subcommand, subcommandGroup, optionDefs = [] }) => {
	const fakeOptions = new CommandInteractionOptionResolver(
		interaction.client,
		buildProxyOptionData(interaction, subcommand, subcommandGroup, optionDefs),
		interaction.options.resolved,
	);

	return new Proxy(interaction, {
		get(target, prop, receiver) {
			if (prop === "options") return fakeOptions;
			if (prop === "commandName") return commandName || target.commandName;
			const value = Reflect.get(target, prop, receiver);
			if (typeof value === "function") return value.bind(target);
			return value;
		},
	});
};

const cloneSlashOptions = (options = []) =>
	options.map((option) => {
		const cloned = {
			name: option.name,
			description: option.description,
			type: option.type,
			required: option.required ?? false,
		};
		if (option.choices) cloned.choices = option.choices.map((choice) => ({ ...choice }));
		if (option.min_value !== undefined) cloned.min_value = option.min_value;
		if (option.max_value !== undefined) cloned.max_value = option.max_value;
		if (option.channel_types) cloned.channel_types = [...option.channel_types];
		return cloned;
	});

const validateCommandName = (name) => {
	const normalized = sanitizeText(name, MAX_NAME_LENGTH).toLowerCase();
	if (!COMMAND_NAME_PATTERN.test(normalized)) {
		return { ok: false, error: "Tên lệnh chỉ được dùng chữ thường, số và dấu gạch ngang (1-32 ký tự)." };
	}
	if (getReservedNames().has(normalized)) {
		return { ok: false, error: "Tên lệnh này đã được hệ thống sử dụng hoặc bị cấm." };
	}
	return { ok: true, value: normalized };
};

const validateDescription = (description) => {
	const value = sanitizeText(description, MAX_DESC_LENGTH);
	if (!value) return { ok: false, error: "Mô tả lệnh không được để trống." };
	return { ok: true, value };
};

const validateResponsePayload = (type, payload = {}) => {
	if (!ALLOWED_TYPES.has(type)) {
		return { ok: false, error: "Loại lệnh không hợp lệ." };
	}

	if (type === "text") {
		const content = sanitizeText(payload.content, MAX_CONTENT_LENGTH);
		if (!content) return { ok: false, error: "Nội dung phản hồi không được để trống." };
		return { ok: true, value: { content } };
	}

	if (type === "embed") {
		const title = sanitizeText(payload.title, 256);
		const description = sanitizeText(payload.description, MAX_EMBED_FIELD_LENGTH);
		if (!title && !description) {
			return { ok: false, error: "Embed cần ít nhất tiêu đề hoặc mô tả." };
		}
		const embed = { title, description };
		if (payload.color) embed.color = sanitizeText(payload.color, 16);
		if (payload.image && isSafeUrl(payload.image)) embed.image = payload.image.trim();
		if (payload.thumbnail && isSafeUrl(payload.thumbnail)) embed.thumbnail = payload.thumbnail.trim();
		return { ok: true, value: { embed } };
	}

	if (type === "components") {
		return parseComponentsLayout(payload.layout ?? payload.content);
	}

	const parsed = parseProxyTarget(payload.target);
	if (!parsed?.command) {
		return { ok: false, error: "Lệnh gốc không hợp lệ. Dùng dạng `command` hoặc `command:subcommand`." };
	}

	const builtIn = useHooks.get("commands")?.get(parsed.command);
	if (!builtIn || builtIn.data?.owner) {
		return { ok: false, error: "Lệnh gốc không tồn tại hoặc không được phép ủy quyền." };
	}
	if (builtIn.data?.category === "musix" || builtIn.data?.lock || builtIn.data?.ckeckVoice) {
		return { ok: false, error: "Không thể ủy quyền lệnh nhạc hoặc lệnh yêu cầu voice channel." };
	}

	const hasSubcommands = commandHasSubcommands(builtIn.data);
	if (hasSubcommands && !parsed.subcommand) {
		return {
			ok: false,
			error: "Lệnh gốc có subcommand. Chỉ định target dạng `command:subcommand` hoặc `command:group:subcommand`.",
		};
	}

	if (parsed.subcommand) {
		const subDef = resolveSubcommandDefinition(builtIn.data, parsed.subcommandGroup, parsed.subcommand);
		if (!subDef) {
			return { ok: false, error: "Subcommand không tồn tại trong lệnh gốc." };
		}
	}

	return {
		ok: true,
		value: {
			target: parsed.command,
			proxyMeta: {
				subcommand: parsed.subcommand,
				subcommandGroup: parsed.subcommandGroup,
			},
		},
	};
};

const buildSlashData = (record) => {
	const slash = {
		name: record.name,
		description: record.description,
		type: 1,
		dm_permission: false,
		default_member_permissions: "0",
	};

	if (record.type !== "proxy" || !record.target) return slash;

	const builtIn = useHooks.get("commands")?.get(record.target);
	if (!builtIn) return slash;

	const { subcommand, subcommandGroup } = record.response || {};
	const subDef = resolveSubcommandDefinition(builtIn.data, subcommandGroup, subcommand);
	if (subDef?.options?.length) {
		slash.options = cloneSlashOptions(subDef.options);
	}

	return slash;
};

const createHandler = (record) => ({
	data: buildSlashData(record),
	isGuildCommand: true,
	guildId: record.guildId,
	record,
	async execute({ interaction, lang }) {
		return executeGuildCommand({ interaction, lang, record });
	},
});

const syncToCache = (record) => {
	if (!record?.enabled) {
		removeFromCache(record.guildId, record.name);
		return null;
	}
	const cache = useHooks.get("guildCommands");
	const handler = createHandler(record);
	cache.set(cacheKey(record.guildId, record.name), handler);
	return handler;
};

const removeFromCache = (guildId, name) => {
	useHooks.get("guildCommands")?.delete(cacheKey(guildId, name));
};

const loadAllToCache = async () => {
	const db = useHooks.get("db");
	const cache = useHooks.get("guildCommands");
	cache.clear();

	if (!db?.ZiGuildCommand) return 0;

	const records = await db.ZiGuildCommand.find({ enabled: true });
	for (const record of records) {
		syncToCache(record);
	}
	return records.length;
};

const getGuildCommandCount = async (guildId) => {
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand) return 0;
	const records = await db.ZiGuildCommand.find({ guildId, enabled: true });
	return records.length;
};

const deployGuildCommands = async (client, guildId) => {
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand || !client?.user?.id) return;

	const records = await db.ZiGuildCommand.find({ guildId, enabled: true });
	let body = records.map(buildSlashData);

	const config = useHooks.get("config");
	const devGuildSet = new Set(config?.DevGuild || []);
	if (devGuildSet.has(guildId)) {
		const ownerCommands = [];
		for (const cmd of useHooks.get("commands").values()) {
			if (cmd.data?.owner) ownerCommands.push(cmd.data);
		}
		body = [...ownerCommands, ...body];
	}

	const rest = new REST().setToken(process.env.TOKEN);
	await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body });
};

const deployAllGuildCommands = async (client) => {
	const db = useHooks.get("db");
	if (!db?.ZiGuildCommand || !client?.user?.id) return;

	const records = await db.ZiGuildCommand.find({ enabled: true });
	const grouped = new Map();
	for (const record of records) {
		if (!grouped.has(record.guildId)) grouped.set(record.guildId, []);
		grouped.get(record.guildId).push(buildSlashData(record));
	}

	const rest = new REST().setToken(process.env.TOKEN);
	for (const [guildId, body] of grouped.entries()) {
		await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body }).catch((error) => {
			useHooks.get("logger")?.warn?.(`Deploy guild commands failed for ${guildId}: ${error.message}`);
		});
	}
};

const resolveEmbedColor = (color) => {
	if (!color) return "Random";
	if (/^#?[0-9a-f]{6}$/i.test(color)) return color.startsWith("#") ? color : `#${color}`;
	return color;
};

const executeGuildCommand = async ({ interaction, record }) => {
	if (!record?.enabled) {
		return interaction.reply({ content: "Lệnh này đã bị vô hiệu hóa.", ephemeral: true });
	}

	if (record.type === "text") {
		const content = sanitizeText(record.response?.content, MAX_CONTENT_LENGTH);
		return interaction.reply({ content, ephemeral: false });
	}

	if (record.type === "embed") {
		const embedData = record.response?.embed || {};
		const embed = new EmbedBuilder();
		if (embedData.title) embed.setTitle(embedData.title);
		if (embedData.description) embed.setDescription(embedData.description);
		if (embedData.color) embed.setColor(resolveEmbedColor(embedData.color));
		if (embedData.image && isSafeUrl(embedData.image)) embed.setImage(embedData.image);
		if (embedData.thumbnail && isSafeUrl(embedData.thumbnail)) embed.setThumbnail(embedData.thumbnail);
		return interaction.reply({ embeds: [embed], ephemeral: false });
	}

	if (record.type === "components") {
		const layoutCheck = parseComponentsLayout(record.response);
		if (!layoutCheck.ok) {
			return interaction.reply({ content: layoutCheck.error, ephemeral: true });
		}
		return interaction.reply(
			buildComponentsReply(layoutCheck.value, {
				user: interaction.user,
				guild: interaction.guild,
			}),
		);
	}

	if (record.type === "proxy") {
		const target = useHooks.get("commands")?.get(record.target);
		if (!target || target.data?.owner) {
			return interaction.reply({ content: "Lệnh gốc không còn khả dụng.", ephemeral: true });
		}

		const { subcommand, subcommandGroup } = record.response || {};
		const subDef = resolveSubcommandDefinition(target.data, subcommandGroup, subcommand);
		const proxiedInteraction = createProxyInteraction(interaction, {
			commandName: record.target,
			subcommand,
			subcommandGroup,
			optionDefs: subDef?.options || [],
		});

		const langfunc = useHooks.get("functions")?.get("ZiRank");
		const lang = langfunc ? await langfunc.execute({ user: interaction.user, XpADD: 1 }) : {};
		return target.execute({ interaction: proxiedInteraction, lang });
	}

	return interaction.reply({ content: "Loại lệnh không được hỗ trợ.", ephemeral: true });
};

const formatProxyTargetLabel = (commandData) => {
	const options = commandData?.options || [];
	const labels = [commandData.name];

	for (const option of options) {
		if (option.type === 1) {
			labels.push(`${commandData.name}:${option.name}`);
		}
		if (option.type === 2) {
			for (const sub of option.options || []) {
				if (sub.type === 1) labels.push(`${commandData.name}:${option.name}:${sub.name}`);
			}
		}
	}

	return labels.slice(1);
};

module.exports = {
	MAX_GUILD_COMMANDS,
	cacheKey,
	validateCommandName,
	validateDescription,
	validateResponsePayload,
	buildSlashData,
	syncToCache,
	removeFromCache,
	loadAllToCache,
	getGuildCommandCount,
	deployGuildCommands,
	deployAllGuildCommands,
	executeGuildCommand,
	createHandler,
	parseProxyTarget,
	resolveSubcommandDefinition,
	formatProxyTargetLabel,
};
