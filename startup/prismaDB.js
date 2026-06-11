const fs = require("node:fs");
const path = require("node:path");
const { useHooks } = require("zihooks");

const CLIENT_MODULES = {
	mongodb: "../node_modules/.prisma/client-mongo",
	sqlite: "../node_modules/.prisma/client-sqlite",
};

const DEFAULT_SQLITE_URL = "file:./jsons/ziDB.sqlite";
const DEFAULT_MONGO_DATABASE = "ziji";
const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|authorization|auth)/i;

const MODEL_CONFIGS = {
	ZiUser: {
		delegate: "ziUser",
		fields: [
			"id",
			"userID",
			"username",
			"avatar",
			"name",
			"xp",
			"level",
			"coin",
			"lang",
			"volume",
			"color",
			"lastDaily",
			"dailyStreak",
			"lastHunt",
			"totalAnimals",
			"huntStats",
			"lootboxes",
			"fabledLootboxes",
			"cookiesGiven",
			"cookiesReceived",
			"lastCookie",
			"thankedCookies",
			"hoyoCookie",
			"genshinAutoClaim",
			"lastGenshinClaim",
			"petCare",
			"lastGive",
			"dailyGives",
			"dailyQuests",
			"weeklyQuests",
			"lastQuestReset",
			"lastWeeklyReset",
			"discordAccessToken",
			"userInfo",
			"guilds",
			"lastLogin",
			"loginCount",
			"createdAt",
			"lastBattle",
			"battleStats",
			"updatedAt",
		],
		indexedFields: ["id", "userID"],
		jsonFields: ["huntStats", "thankedCookies", "petCare", "dailyQuests", "weeklyQuests", "userInfo", "guilds", "battleStats"],
		dateFields: [
			"createdAt",
			"lastDaily",
			"lastHunt",
			"lastCookie",
			"lastGenshinClaim",
			"lastGive",
			"lastQuestReset",
			"lastWeeklyReset",
			"lastLogin",
			"lastBattle",
			"updatedAt",
		],
		defaults: {
			level: 1,
			coin: 0,
			volume: 100,
			color: "Random",
			dailyStreak: 0,
			totalAnimals: 0,
			huntStats: {},
			lootboxes: 0,
			fabledLootboxes: 0,
			cookiesGiven: 0,
			cookiesReceived: 0,
			thankedCookies: [],
			genshinAutoClaim: false,
			dailyGives: 0,
			dailyQuests: [],
			weeklyQuests: [],
			userInfo: {},
			guilds: [],
			loginCount: 0,
			battleStats: { wins: 0, losses: 0, total: 0 },
		},
		touchUpdatedAt: true,
	},
	ZiAutoresponder: {
		delegate: "ziAutoresponder",
		fields: ["id", "guildId", "trigger", "response", "options", "createdAt", "updatedAt"],
		indexedFields: ["id", "guildId"],
		jsonFields: ["options"],
		dateFields: ["createdAt", "updatedAt"],
		defaults: {
			options: { matchMode: "exactly" },
		},
	},
	ZiWelcome: {
		delegate: "ziWelcome",
		fields: ["id", "guildId", "channel", "content", "Bchannel", "Bcontent", "createdAt", "updatedAt"],
		indexedFields: ["id", "guildId"],
		jsonFields: [],
		dateFields: ["createdAt", "updatedAt"],
		defaults: {},
	},
	ZiGuild: {
		delegate: "ziGuild",
		fields: ["id", "guildId", "voice", "joinToCreate", "autoRole", "music_channel", "updatedAt", "noitu"],
		indexedFields: ["id", "guildId"],
		jsonFields: ["voice", "joinToCreate", "autoRole", "noitu"],
		dateFields: ["updatedAt"],
		defaults: {
			voice: { logMode: false },
			joinToCreate: {
				enabled: false,
				voiceChannelId: null,
				categoryId: null,
				defaultUserLimit: 0,
				tempChannels: [],
				blockedUser: [],
			},
			autoRole: { enabled: false, roleIds: [] },
			music_channel: null,
			noitu: {
				enabled: false,
				channel: null,
				lastPlayer: null,
				lastWord: null,
			},
		},
		touchUpdatedAt: true,
	},
	ZiConfess: {
		delegate: "ziConfess",
		fields: ["id", "enabled", "guildId", "channelId", "reviewSystem", "reviewChannelId", "currentId", "confessions"],
		indexedFields: ["id", "guildId"],
		jsonFields: ["confessions"],
		dateFields: [],
		defaults: {
			enabled: false,
			reviewSystem: false,
			reviewChannelId: null,
			currentId: 0,
			confessions: [],
		},
	},
};

const SQLITE_SCHEMA_SQL = [
	`CREATE TABLE IF NOT EXISTS "ziusers" (
		"id" TEXT NOT NULL PRIMARY KEY,
		"userID" TEXT,
		"username" TEXT,
		"avatar" TEXT,
		"name" TEXT,
		"xp" INTEGER,
		"level" INTEGER,
		"coin" INTEGER,
		"lang" TEXT,
		"volume" INTEGER,
		"color" TEXT,
		"lastDaily" DATETIME,
		"dailyStreak" INTEGER,
		"lastHunt" DATETIME,
		"totalAnimals" INTEGER,
		"huntStats" TEXT,
		"lootboxes" INTEGER,
		"fabledLootboxes" INTEGER,
		"cookiesGiven" INTEGER,
		"cookiesReceived" INTEGER,
		"lastCookie" DATETIME,
		"thankedCookies" TEXT,
		"hoyoCookie" TEXT,
		"genshinAutoClaim" BOOLEAN,
		"lastGenshinClaim" DATETIME,
		"petCare" TEXT,
		"lastGive" DATETIME,
		"dailyGives" INTEGER,
		"dailyQuests" TEXT,
		"weeklyQuests" TEXT,
		"lastQuestReset" DATETIME,
		"lastWeeklyReset" DATETIME,
		"discordAccessToken" TEXT,
		"userInfo" TEXT,
		"guilds" TEXT,
		"lastLogin" DATETIME,
		"loginCount" INTEGER,
		"createdAt" DATETIME,
		"lastBattle" DATETIME,
		"battleStats" TEXT,
		"updatedAt" DATETIME
	)`,
	`CREATE INDEX IF NOT EXISTS "ziusers_userID_idx" ON "ziusers"("userID")`,
	`CREATE TABLE IF NOT EXISTS "ziautoresponders" (
		"id" TEXT NOT NULL PRIMARY KEY,
		"guildId" TEXT NOT NULL,
		"trigger" TEXT NOT NULL,
		"response" TEXT NOT NULL,
		"options" TEXT,
		"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS "ziautoresponders_guildId_idx" ON "ziautoresponders"("guildId")`,
	`CREATE TABLE IF NOT EXISTS "ziwelcomes" (
		"id" TEXT NOT NULL PRIMARY KEY,
		"guildId" TEXT NOT NULL,
		"channel" TEXT,
		"content" TEXT,
		"Bchannel" TEXT,
		"Bcontent" TEXT,
		"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS "ziwelcomes_guildId_idx" ON "ziwelcomes"("guildId")`,
	`CREATE TABLE IF NOT EXISTS "ziguilds" (
		"id" TEXT NOT NULL PRIMARY KEY,
		"guildId" TEXT NOT NULL,
		"voice" TEXT,
		"joinToCreate" TEXT,
		"autoRole" TEXT,
		"music_channel" TEXT,
		"updatedAt" DATETIME,
		"noitu" TEXT
	)`,
	`CREATE INDEX IF NOT EXISTS "ziguilds_guildId_idx" ON "ziguilds"("guildId")`,
	`CREATE TABLE IF NOT EXISTS "ziconfesses" (
		"id" TEXT NOT NULL PRIMARY KEY,
		"enabled" BOOLEAN,
		"guildId" TEXT NOT NULL,
		"channelId" TEXT,
		"reviewSystem" BOOLEAN,
		"reviewChannelId" TEXT,
		"currentId" INTEGER,
		"confessions" TEXT
	)`,
	`CREATE INDEX IF NOT EXISTS "ziconfesses_guildId_idx" ON "ziconfesses"("guildId")`,
];

const SQLITE_ADDITIONAL_COLUMNS = {
	ziusers: [
		["username", "TEXT"],
		["avatar", "TEXT"],
		["lastLogin", "DATETIME"],
		["loginCount", "INTEGER"],
		["createdAt", "DATETIME"],
		["lastBattle", "DATETIME"],
		["battleStats", "TEXT"],
	],
	ziguilds: [["noitu", "TEXT"]],
};

const clone = (value) => {
	if (value === undefined || value === null) return value;
	if (value instanceof Date) return new Date(value.getTime());
	if (Array.isArray(value) || typeof value === "object") return JSON.parse(JSON.stringify(value));
	return value;
};

const getLogger = (fallbackLogger) => fallbackLogger || useHooks.get("logger");

const stringifyLogDetails = (details) => {
	try {
		return JSON.stringify(details);
	} catch {
		return String(details);
	}
};

const debugPrisma = (message, details, fallbackLogger) => {
	if (useHooks.get("config")?.DevConfig?.prisma_DEBUG !== true) return;
	const logger = getLogger(fallbackLogger);
	if (!logger?.debug) return;
	logger.debug(details === undefined ? message : `${message} ${stringifyLogDetails(details)}`);
};

const redactForLog = (value, depth = 0) => {
	if (value === undefined || value === null) return value;
	if (depth > 4) return "[MaxDepth]";
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForLog(item, depth + 1));
	if (!isPlainObject(value)) return value;

	const result = {};
	for (const [key, entry] of Object.entries(value)) {
		result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : redactForLog(entry, depth + 1);
	}
	return result;
};

const getDataSummary = (data = {}) => ({
	fields: Object.keys(data || {}),
	data: redactForLog(data),
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const isContainer = (value) => value && typeof value === "object" && !(value instanceof Date);

const isArrayIndex = (part) => /^\d+$/.test(part);

const keyFor = (container, part) => (Array.isArray(container) && isArrayIndex(part) ? Number(part) : part);

const resolvePositionalParts = (pathParts, positionalIndexes = {}) => {
	const resolved = [];
	for (const part of pathParts) {
		if (part === "$") {
			const arrayField = resolved[resolved.length - 1];
			const index = positionalIndexes[arrayField];
			resolved.push(index === undefined ? part : String(index));
			continue;
		}
		resolved.push(part);
	}
	return resolved;
};

const getPathParts = (current, pathParts) => {
	if (pathParts.length === 0) return current;
	if (current == null) return undefined;

	const [part, ...remaining] = pathParts;
	if (Array.isArray(current)) {
		if (isArrayIndex(part)) return getPathParts(current[Number(part)], remaining);
		const values = current.map((item) => getPathParts(item, pathParts)).filter((value) => value !== undefined);
		return values.length === 0 ? undefined : values;
	}

	return getPathParts(current[part], remaining);
};

const getPath = (object, dottedPath) => {
	return getPathParts(object, dottedPath.split("."));
};

const setPath = (object, dottedPath, value, positionalIndexes = {}) => {
	const pathParts = resolvePositionalParts(dottedPath.split("."), positionalIndexes);
	let current = object;
	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		const key = keyFor(current, part);
		const nextPart = pathParts[i + 1];
		if (!isContainer(current[key])) current[key] = isArrayIndex(nextPart) ? [] : {};
		current = current[key];
	}
	current[keyFor(current, pathParts[pathParts.length - 1])] = value;
};

const unsetPath = (object, dottedPath, positionalIndexes = {}) => {
	const pathParts = resolvePositionalParts(dottedPath.split("."), positionalIndexes);
	let current = object;
	for (let i = 0; i < pathParts.length - 1; i++) {
		current = current?.[keyFor(current, pathParts[i])];
		if (current == null) return;
	}
	delete current[keyFor(current, pathParts[pathParts.length - 1])];
};

const parseJsonField = (value, fallback) => {
	if (value === undefined) return clone(fallback);
	if (value === null || value === "") return value === null ? null : clone(fallback);
	if (typeof value !== "string") return clone(value);
	try {
		return JSON.parse(value);
	} catch {
		return clone(fallback);
	}
};

const addDefaults = (data, config) => {
	const result = { ...data };
	const jsonFields = new Set(config.jsonFields || []);
	for (const [field, value] of Object.entries(config.defaults || {})) {
		if (jsonFields.has(field)) {
			if (result[field] === undefined) result[field] = clone(value);
		} else {
			if (result[field] == null) result[field] = clone(value);
		}
	}
	return result;
};

const normalizeIdFilter = (filter = {}) => {
	const normalized = { ...filter };
	if (normalized._id && !normalized.id) {
		normalized.id = normalized._id;
		delete normalized._id;
	}
	return normalized;
};

const hasOperator = (value) => isPlainObject(value) && Object.keys(value).some((key) => key.startsWith("$"));

const matchesOperator = (actual, operator, expected) => {
	if (Array.isArray(actual) && operator !== "$ne") {
		return actual.some((item) => matchesOperator(item, operator, expected));
	}

	switch (operator) {
		case "$gte":
			return actual >= expected;
		case "$gt":
			return actual > expected;
		case "$lte":
			return actual <= expected;
		case "$lt":
			return actual < expected;
		case "$ne":
			return Array.isArray(actual) ? !actual.some((item) => deepEqual(item, expected)) : !deepEqual(actual, expected);
		case "$in":
			if (!Array.isArray(expected)) return false;
			return Array.isArray(actual) ?
					actual.some((actualItem) => expected.some((expectedItem) => deepEqual(expectedItem, actualItem)))
				:	expected.some((item) => deepEqual(item, actual));
		case "$exists":
			return expected ? actual !== undefined : actual === undefined;
		default:
			return false;
	}
};

const matchesFilter = (document, rawFilter = {}) => {
	const filter = normalizeIdFilter(rawFilter);

	for (const [fieldPath, expected] of Object.entries(filter)) {
		if (fieldPath === "$and" && Array.isArray(expected)) {
			if (!expected.every((entry) => matchesFilter(document, entry))) return false;
			continue;
		}
		if (fieldPath === "$or" && Array.isArray(expected)) {
			if (!expected.some((entry) => matchesFilter(document, entry))) return false;
			continue;
		}

		const actual = getPath(document, fieldPath);
		if (hasOperator(expected)) {
			for (const [operator, operatorValue] of Object.entries(expected)) {
				if (!matchesOperator(actual, operator, operatorValue)) return false;
			}
			continue;
		}

		if (Array.isArray(actual)) {
			if (!actual.some((item) => deepEqual(item, expected))) return false;
			continue;
		}

		if (!deepEqual(actual, expected)) return false;
	}

	return true;
};

const toPrismaFieldWhere = (field, value, config) => {
	const fields = new Set(config.fields || []);
	const jsonFields = new Set(config.jsonFields || []);
	if (!fields.has(field) || field.includes(".") || jsonFields.has(field)) return null;

	if (!hasOperator(value)) {
		if (isPlainObject(value)) return null;
		return { [field]: value };
	}

	const operatorWhere = {};
	for (const [operator, operatorValue] of Object.entries(value)) {
		switch (operator) {
			case "$gte":
				operatorWhere.gte = operatorValue;
				break;
			case "$gt":
				operatorWhere.gt = operatorValue;
				break;
			case "$lte":
				operatorWhere.lte = operatorValue;
				break;
			case "$lt":
				operatorWhere.lt = operatorValue;
				break;
			case "$ne":
				operatorWhere.not = operatorValue;
				break;
			case "$in":
				if (!Array.isArray(operatorValue)) return null;
				operatorWhere.in = operatorValue;
				break;
			case "$exists":
				operatorWhere[operatorValue ? "not" : "equals"] = null;
				break;
			default:
				return null;
		}
	}

	return Object.keys(operatorWhere).length ? { [field]: operatorWhere } : null;
};

const getPrismaWhere = (filter = {}, config) => {
	const normalized = normalizeIdFilter(filter);
	const entries = Object.entries(normalized);
	if (entries.length === 0) return null;

	const andClauses = [];
	for (const [field, value] of entries) {
		if (field === "$and" && Array.isArray(value)) {
			for (const entry of value) {
				const nestedWhere = getPrismaWhere(entry, config);
				if (nestedWhere && Object.keys(nestedWhere).length) andClauses.push(nestedWhere);
			}
			continue;
		}
		if (field === "$or") continue;

		const fieldWhere = toPrismaFieldWhere(field, value, config);
		if (fieldWhere) andClauses.push(fieldWhere);
	}

	if (andClauses.length === 0) return null;
	if (andClauses.length === 1) return andClauses[0];
	return { AND: andClauses };
};

const applyProjection = (document, projection) => {
	if (!projection || Object.keys(projection).length === 0) return document;

	const includeFields = Object.entries(projection)
		.filter(([, enabled]) => enabled)
		.map(([field]) => field);
	if (includeFields.length === 0) return document;

	const projected = {};
	for (const field of includeFields) {
		if (document[field] !== undefined) projected[field] = document[field];
	}
	if (document.id !== undefined) projected.id = document.id;
	if (document._id !== undefined) projected._id = document._id;
	return projected;
};

const makeQuery = (executor) => {
	let promise;
	const getPromise = () => {
		if (!promise) promise = Promise.resolve().then(executor);
		return promise;
	};

	return {
		then: (...args) => getPromise().then(...args),
		catch: (...args) => getPromise().catch(...args),
		finally: (...args) => getPromise().finally(...args),
		lean: () => getPromise().then((result) => clone(result)),
	};
};

const findPositionalIndexes = (document, filter = {}) => {
	const normalized = normalizeIdFilter(filter);
	const grouped = {};

	for (const [fieldPath, expected] of Object.entries(normalized)) {
		if (fieldPath.startsWith("$") || !fieldPath.includes(".")) continue;
		const [arrayField, ...rest] = fieldPath.split(".");
		const array = document?.[arrayField];
		if (!Array.isArray(array) || rest.length === 0) continue;
		if (!grouped[arrayField]) grouped[arrayField] = {};
		grouped[arrayField][rest.join(".")] = expected;
	}

	const indexes = {};
	for (const [arrayField, elementFilter] of Object.entries(grouped)) {
		const array = document[arrayField];
		const index = array.findIndex((item) => matchesFilter(item, elementFilter));
		if (index !== -1) indexes[arrayField] = index;
	}

	return indexes;
};

const applyUpdate = (document, update = {}, options = {}) => {
	const next = clone(document) || {};
	let upsertFromBody = false;
	const positionalIndexes = findPositionalIndexes(next, options.filter);
	const operatorEntries = Object.entries(update).filter(([key]) => key.startsWith("$"));
	const plainEntries = Object.entries(update).filter(([key]) => !key.startsWith("$"));

	for (const [fieldPath, value] of plainEntries) {
		setPath(next, fieldPath, value, positionalIndexes);
	}

	for (const [operator, values] of operatorEntries) {
		if (operator === "$upsert") {
			upsertFromBody = Boolean(values);
			continue;
		}
		if (operator === "$setOnInsert" && !options.isInsert) continue;
		if (!isPlainObject(values)) continue;

		for (const [fieldPath, value] of Object.entries(values)) {
			switch (operator) {
				case "$set":
				case "$setOnInsert":
					setPath(next, fieldPath, value, positionalIndexes);
					break;
				case "$inc": {
					const currentPathParts = resolvePositionalParts(fieldPath.split("."), positionalIndexes);
					const current = Number(getPathParts(next, currentPathParts) || 0);
					setPath(next, fieldPath, current + Number(value), positionalIndexes);
					break;
				}
				case "$unset":
					unsetPath(next, fieldPath, positionalIndexes);
					break;
				case "$addToSet": {
					const current = getPath(next, fieldPath);
					const array = Array.isArray(current) ? current : [];
					if (!array.some((item) => deepEqual(item, value))) array.push(value);
					setPath(next, fieldPath, array, positionalIndexes);
					break;
				}
				case "$push": {
					const current = getPath(next, fieldPath);
					const array = Array.isArray(current) ? current : [];
					array.push(value);
					setPath(next, fieldPath, array, positionalIndexes);
					break;
				}
			}
		}
	}

	return { document: next, upsertFromBody };
};

const extractEqualityFields = (filter = {}) => {
	const result = {};
	const normalized = normalizeIdFilter(filter);
	for (const [fieldPath, value] of Object.entries(normalized)) {
		if (fieldPath.includes(".") || fieldPath.startsWith("$") || hasOperator(value) || isPlainObject(value)) continue;
		result[fieldPath] = value;
	}
	return result;
};

const prepareForPrisma = (document, config, provider, includeId = false) => {
	const jsonFields = new Set(config.jsonFields || []);
	const dateFields = new Set(config.dateFields || []);
	const fields = new Set(config.fields || []);
	const result = {};

	for (const [field, value] of Object.entries(document || {})) {
		if (field === "_id" || field === "save") continue;
		if (field === "id" && !includeId) continue;
		if (fields.size && !fields.has(field)) continue;
		if (value === undefined) continue;

		if (provider === "sqlite" && jsonFields.has(field)) {
			result[field] = value === null ? null : JSON.stringify(value);
			continue;
		}

		if (dateFields.has(field) && value && !(value instanceof Date)) {
			result[field] = new Date(value);
			continue;
		}

		result[field] = value;
	}

	if (config.touchUpdatedAt) result.updatedAt = new Date();
	return result;
};

const createDocument = (data, model) => {
	const document = { ...data, _id: data.id };
	Object.defineProperty(document, "_doc", {
		enumerable: false,
		configurable: true,
		get() {
			const plain = {};
			for (const [key, value] of Object.entries(document)) {
				if (key === "_doc" || key === "save") continue;
				plain[key] = value;
			}
			return plain;
		},
	});
	Object.defineProperty(document, "save", {
		enumerable: false,
		value: async () => {
			const saved = await model._saveDocument(document);
			Object.assign(document, saved);
			return document;
		},
	});
	return document;
};

const hydrateRow = (row, config, provider, model) => {
	if (!row) return null;

	const jsonFields = new Set(config.jsonFields || []);
	const defaults = config.defaults || {};
	const document = {};

	for (const [field, value] of Object.entries(row)) {
		document[field] = provider === "sqlite" && jsonFields.has(field) ? parseJsonField(value, defaults[field]) : clone(value);
	}

	return createDocument(addDefaults(document, config), model);
};

const normalizeSqliteUrl = (sqliteUrl = DEFAULT_SQLITE_URL) => {
	if (!sqliteUrl.startsWith("file:")) return sqliteUrl;
	const rawPath = sqliteUrl.replace(/^file:/, "");
	const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
	return `file:${absolutePath.replace(/\\/g, "/")}`;
};

const parseMongoUrl = (mongoUrl = "") => {
	const trimmedUrl = mongoUrl.trim();
	if (!trimmedUrl) throw new Error("MONGO is not configured");
	if (!/^mongodb(?:\+srv)?:\/\//i.test(trimmedUrl)) {
		throw new Error("MONGO must be a valid mongodb:// or mongodb+srv:// connection string");
	}

	try {
		return new URL(trimmedUrl);
	} catch {
		throw new Error("MONGO must be a valid mongodb:// or mongodb+srv:// connection string");
	}
};

const getMongoDatabaseName = (mongoUrl = "") => {
	const url = typeof mongoUrl === "string" ? parseMongoUrl(mongoUrl) : mongoUrl;
	return decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
};

const redactMongoUrl = (mongoUrl = "") => {
	try {
		const url = parseMongoUrl(mongoUrl);
		if (url.username) url.username = "***";
		if (url.password) url.password = "***";
		return url.toString();
	} catch {
		return "<invalid MongoDB URI>";
	}
};

const normalizeMongoUrl = (mongoUrl = "", options = {}) => {
	const logger = options.logger;
	const url = parseMongoUrl(mongoUrl);
	let database = getMongoDatabaseName(url);
	const appName = (url.searchParams.get("appName") || "").trim();

	if (!database) {
		if (!appName) {
			throw new Error(
				`MONGO must include a database name in the URI path, for example mongodb+srv://user:pass@cluster.mongodb.net/${DEFAULT_MONGO_DATABASE}?retryWrites=true&w=majority`,
			);
		}

		database = appName;
		url.pathname = `/${encodeURIComponent(appName)}`;
		logger?.debug?.(`[Prisma] MongoDB URI missing database name; using appName "${appName}" as database name.`);
	}

	const normalizedUrl = url.toString();
	logger?.debug?.(`[Prisma] MongoDB database: ${database}`);
	logger?.debug?.(`[Prisma] MongoDB URI: ${redactMongoUrl(normalizedUrl)}`);

	return normalizedUrl;
};

const ensureSqliteFile = (sqliteUrl = process.env.SQLITE_DATABASE_URL || DEFAULT_SQLITE_URL) => {
	const relativePath = sqliteUrl.replace(/^file:/, "");
	if (path.isAbsolute(relativePath)) {
		fs.mkdirSync(path.dirname(relativePath), { recursive: true });
	} else {
		fs.mkdirSync(path.dirname(path.resolve(process.cwd(), relativePath)), { recursive: true });
	}
};

const ensureSqliteSchema = async (prisma) => {
	ensureSqliteFile();
	for (const sql of SQLITE_SCHEMA_SQL) {
		await prisma.$executeRawUnsafe(sql);
	}

	for (const [table, columns] of Object.entries(SQLITE_ADDITIONAL_COLUMNS)) {
		const existingColumns = new Set((await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`)).map((column) => column.name));
		for (const [column, definition] of columns) {
			if (!existingColumns.has(column)) {
				await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
			}
		}
	}
};

const createTransactionShim = (prisma) => ({
	startSession: async () => {
		const session = {
			_tx: null,
			withTransaction: async (callback) => {
				debugPrisma("[PrismaTransaction] start");
				return prisma.$transaction(async (tx) => {
					session._tx = tx;
					try {
						const result = await callback();
						debugPrisma("[PrismaTransaction] commit");
						return result;
					} catch (error) {
						debugPrisma("[PrismaTransaction] rollback", { error: error?.message || String(error) });
						throw error;
					} finally {
						session._tx = null;
					}
				});
			},
			endSession: async () => {
				session._tx = null;
			},
		};
		return session;
	},
});

const createPrismaModel = (prisma, provider, config, modelName = config.delegate) => {
	const getDelegate = (options = {}) => (options.session?._tx || prisma)[config.delegate];

	class PrismaModel {
		constructor(data = {}) {
			Object.assign(this, addDefaults(data, config));
		}

		async save() {
			const saved = await PrismaModel._saveDocument(this);
			Object.assign(this, saved);
			return this;
		}

		static _hydrate(row) {
			return hydrateRow(row, config, provider, PrismaModel);
		}

		static async _fetch(filter = {}, options = {}) {
			const delegate = getDelegate(options);
			const where = getPrismaWhere(filter, config);
			const startedAt = Date.now();
			debugPrisma("[PrismaModel] findMany start", {
				provider,
				model: modelName,
				filter: redactForLog(filter),
				where: redactForLog(where),
			});

			try {
				const hasWhere = where && Object.keys(where).length > 0;
				const rows = hasWhere ? await delegate.findMany({ where }) : await delegate.findMany();
				const documents = rows.map((row) => PrismaModel._hydrate(row)).filter((document) => matchesFilter(document, filter));
				debugPrisma("[PrismaModel] findMany done", {
					provider,
					model: modelName,
					rowCount: rows.length,
					matchedCount: documents.length,
					durationMs: Date.now() - startedAt,
				});
				return documents;
			} catch (error) {
				debugPrisma("[PrismaModel] findMany error", {
					provider,
					model: modelName,
					durationMs: Date.now() - startedAt,
					error: error?.message || String(error),
				});
				throw error;
			}
		}

		static async _saveDocument(document, options = {}) {
			const delegate = getDelegate(options);
			const source = addDefaults(clone(document), config);
			const data = prepareForPrisma(source, config, provider);
			let saved;
			const startedAt = Date.now();
			const operation = source.id ? "updateOrCreate" : "create";
			debugPrisma("[PrismaModel] save start", {
				provider,
				model: modelName,
				operation,
				id: source.id,
				...getDataSummary(data),
			});

			try {
				if (source.id) {
					try {
						saved = await delegate.update({ where: { id: source.id }, data });
					} catch (updateError) {
						const createData = prepareForPrisma(source, config, provider, true);
						debugPrisma("[PrismaModel] update missed; falling back to create", {
							provider,
							model: modelName,
							id: source.id,
							error: updateError?.message || String(updateError),
							...getDataSummary(createData),
						});
						saved = await delegate.create({ data: createData });
					}
				} else {
					saved = await delegate.create({ data });
				}

				debugPrisma("[PrismaModel] save done", {
					provider,
					model: modelName,
					operation,
					id: saved?.id,
					durationMs: Date.now() - startedAt,
				});
			} catch (error) {
				debugPrisma("[PrismaModel] save error", {
					provider,
					model: modelName,
					operation,
					id: source.id,
					durationMs: Date.now() - startedAt,
					error: error?.message || String(error),
				});
				throw error;
			}

			return PrismaModel._hydrate(saved);
		}

		static find(filter = {}, projection) {
			return makeQuery(async () => {
				const documents = await PrismaModel._fetch(filter);
				return documents.map((document) => applyProjection(document, projection));
			});
		}

		static findOne(filter = {}, projection) {
			return makeQuery(async () => {
				const documents = await PrismaModel._fetch(filter);
				return documents[0] ? applyProjection(documents[0], projection) : null;
			});
		}

		static async create(data = {}) {
			return PrismaModel._saveDocument(new PrismaModel(data));
		}

		static async updateOne(filter = {}, update = {}, options = {}) {
			const startedAt = Date.now();
			debugPrisma("[PrismaModel] updateOne start", {
				provider,
				model: modelName,
				filter: redactForLog(filter),
				update: redactForLog(update),
				options: redactForLog(options),
			});
			const documents = await PrismaModel._fetch(filter, options);
			const matched = documents[0];
			const updateState = applyUpdate(matched || extractEqualityFields(filter), update, {
				filter,
				isInsert: !matched,
			});
			const shouldUpsert = options.upsert || updateState.upsertFromBody;

			if (!matched && !shouldUpsert) {
				const result = { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
				debugPrisma("[PrismaModel] updateOne done", { provider, model: modelName, durationMs: Date.now() - startedAt, result });
				return result;
			}

			const saved = await PrismaModel._saveDocument(updateState.document, options);
			const result = {
				acknowledged: true,
				matchedCount: matched ? 1 : 0,
				modifiedCount: matched ? 1 : 0,
				upsertedCount: matched ? 0 : 1,
				upsertedId: matched ? null : saved.id,
			};
			debugPrisma("[PrismaModel] updateOne done", { provider, model: modelName, durationMs: Date.now() - startedAt, result });
			return result;
		}

		static async findOneAndUpdate(filter = {}, update = {}, options = {}) {
			const startedAt = Date.now();
			debugPrisma("[PrismaModel] findOneAndUpdate start", {
				provider,
				model: modelName,
				filter: redactForLog(filter),
				update: redactForLog(update),
				options: redactForLog(options),
			});
			const documents = await PrismaModel._fetch(filter, options);
			const matched = documents[0];

			if (!matched && !options.upsert) {
				debugPrisma("[PrismaModel] findOneAndUpdate done", {
					provider,
					model: modelName,
					durationMs: Date.now() - startedAt,
					result: null,
				});
				return null;
			}

			const base = matched || extractEqualityFields(filter);
			const updateState = applyUpdate(base, update, {
				filter,
				isInsert: !matched,
			});
			const saved = await PrismaModel._saveDocument(updateState.document, options);
			debugPrisma("[PrismaModel] findOneAndUpdate done", {
				provider,
				model: modelName,
				durationMs: Date.now() - startedAt,
				id: saved?.id,
			});
			return saved;
		}

		static async findByIdAndUpdate(id, update = {}, options = {}) {
			return PrismaModel.findOneAndUpdate({ id }, update, options);
		}
	}

	PrismaModel.db = createTransactionShim(prisma);
	return PrismaModel;
};

const loadPrismaClient = (provider) => {
	const modulePath = CLIENT_MODULES[provider];
	if (!modulePath) throw new Error(`Unsupported Prisma provider: ${provider}`);
	return require(modulePath).PrismaClient;
};

const createDatabaseApi = (prisma, provider) => {
	const api = { prisma, provider };
	for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
		api[name] = createPrismaModel(prisma, provider, config, name);
	}
	api.disconnect = () => prisma.$disconnect();
	return api;
};

const summarizePrismaParams = (params) => {
	if (!params || params === "[]") return params;
	try {
		const parsed = JSON.parse(params);
		if (isPlainObject(parsed)) return redactForLog(parsed);
		if (Array.isArray(parsed)) return { type: "array", count: parsed.length };
		return { type: typeof parsed };
	} catch {
		return { length: String(params).length };
	}
};

const attachPrismaQueryDebug = (prisma, provider, fallbackLogger) => {
	if (typeof prisma.$on !== "function") return;

	try {
		prisma.$on("query", (event) => {
			debugPrisma(
				"[PrismaQuery]",
				{
					provider,
					query: event.query,
					params: summarizePrismaParams(event.params),
					durationMs: event.duration,
					target: event.target,
				},
				fallbackLogger,
			);
		});
	} catch (error) {
		debugPrisma(
			"[PrismaQuery] failed to attach query logger",
			{ provider, error: error?.message || String(error) },
			fallbackLogger,
		);
	}
};

const connectPrismaDatabase = async (provider, options = {}) => {
	const logger = getLogger(options.logger);

	if (provider === "sqlite") {
		process.env.SQLITE_DATABASE_URL = normalizeSqliteUrl(process.env.SQLITE_DATABASE_URL || DEFAULT_SQLITE_URL);
		ensureSqliteFile(process.env.SQLITE_DATABASE_URL);
		logger?.debug?.(`[Prisma] SQLite database URL: ${process.env.SQLITE_DATABASE_URL}`);
	} else if (provider === "mongodb") {
		process.env.MONGO = normalizeMongoUrl(process.env.MONGO, { logger });
	}

	const PrismaClient = loadPrismaClient(provider);
	logger?.debug?.(`[Prisma] Creating ${provider} PrismaClient.`);
	const prismaOptions =
		provider === "sqlite" ?
			{
				datasources: { db: { url: process.env.SQLITE_DATABASE_URL } },
				log: [{ emit: "event", level: "query" }],
			}
		:	{
				datasources: { db: { url: process.env.MONGO } },
				log: [{ emit: "event", level: "query" }],
			};
	const prisma = new PrismaClient(prismaOptions);
	attachPrismaQueryDebug(prisma, provider, logger);

	logger?.debug?.(`[Prisma] Connecting to ${provider}.`);
	await prisma.$connect();
	if (provider === "sqlite") await ensureSqliteSchema(prisma);
	logger?.debug?.(`[Prisma] Connected to ${provider}.`);

	return createDatabaseApi(prisma, provider);
};

module.exports = {
	connectPrismaDatabase,
	_internals: {
		addDefaults,
		hydrateRow,
		getMongoDatabaseName,
		normalizeMongoUrl,
		redactMongoUrl,
		getPrismaWhere,
	},
};
