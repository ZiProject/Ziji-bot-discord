const fs = require("node:fs");
const path = require("node:path");

const CLIENT_MODULES = {
	mongodb: "../node_modules/.prisma/client-mongo",
	sqlite: "../node_modules/.prisma/client-sqlite",
};

const DEFAULT_SQLITE_URL = "file:./jsons/ziDB.sqlite";

const MODEL_CONFIGS = {
	ZiUser: {
		delegate: "ziUser",
		indexedFields: ["id", "userID"],
		jsonFields: ["huntStats", "thankedCookies", "petCare", "dailyQuests", "weeklyQuests", "userInfo", "guilds"],
		dateFields: [
			"lastDaily",
			"lastHunt",
			"lastCookie",
			"lastGenshinClaim",
			"lastGive",
			"lastQuestReset",
			"lastWeeklyReset",
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
		},
		touchUpdatedAt: true,
	},
	ZiAutoresponder: {
		delegate: "ziAutoresponder",
		indexedFields: ["id", "guildId"],
		jsonFields: ["options"],
		dateFields: ["createdAt", "updatedAt"],
		defaults: {
			options: { matchMode: "exactly" },
		},
	},
	ZiWelcome: {
		delegate: "ziWelcome",
		indexedFields: ["id", "guildId"],
		jsonFields: [],
		dateFields: ["createdAt", "updatedAt"],
		defaults: {},
	},
	ZiGuild: {
		delegate: "ziGuild",
		indexedFields: ["id", "guildId"],
		jsonFields: ["voice", "joinToCreate", "autoRole"],
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
		},
		touchUpdatedAt: true,
	},
	ZiConfess: {
		delegate: "ziConfess",
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
		"updatedAt" DATETIME
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

const clone = (value) => {
	if (value === undefined || value === null) return value;
	if (value instanceof Date) return new Date(value.getTime());
	if (Array.isArray(value) || typeof value === "object") return JSON.parse(JSON.stringify(value));
	return value;
};

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const getPath = (object, dottedPath) => {
	const pathParts = dottedPath.split(".");
	let current = object;
	for (const part of pathParts) {
		if (current == null) return undefined;
		current = current[part];
	}
	return current;
};

const setPath = (object, dottedPath, value) => {
	const pathParts = dottedPath.split(".");
	let current = object;
	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		if (!isPlainObject(current[part])) current[part] = {};
		current = current[part];
	}
	current[pathParts[pathParts.length - 1]] = value;
};

const unsetPath = (object, dottedPath) => {
	const pathParts = dottedPath.split(".");
	let current = object;
	for (let i = 0; i < pathParts.length - 1; i++) {
		current = current?.[pathParts[i]];
		if (current == null) return;
	}
	delete current[pathParts[pathParts.length - 1]];
};

const parseJsonField = (value, fallback) => {
	if (value === undefined || value === null || value === "") return clone(fallback);
	if (typeof value !== "string") return clone(value);
	try {
		return JSON.parse(value);
	} catch {
		return clone(fallback);
	}
};

const addDefaults = (data, config) => {
	const result = { ...data };
	for (const [field, value] of Object.entries(config.defaults || {})) {
		if (result[field] === undefined || result[field] === null) result[field] = clone(value);
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
			return Array.isArray(expected) && expected.some((item) => deepEqual(item, actual));
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

		if (!deepEqual(actual, expected)) return false;
	}

	return true;
};

const getSimpleWhere = (filter = {}, config) => {
	const normalized = normalizeIdFilter(filter);
	const entries = Object.entries(normalized);
	if (entries.length === 0) return {};

	const where = {};
	for (const [field, value] of entries) {
		if (!config.indexedFields.includes(field) || field.includes(".") || hasOperator(value) || isPlainObject(value)) {
			return null;
		}
		where[field] = value;
	}
	return where;
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

const applyUpdate = (document, update = {}) => {
	const next = clone(document) || {};
	let upsertFromBody = false;
	const operatorEntries = Object.entries(update).filter(([key]) => key.startsWith("$"));
	const plainEntries = Object.entries(update).filter(([key]) => !key.startsWith("$"));

	for (const [fieldPath, value] of plainEntries) {
		setPath(next, fieldPath, value);
	}

	for (const [operator, values] of operatorEntries) {
		if (operator === "$upsert") {
			upsertFromBody = Boolean(values);
			continue;
		}
		if (!isPlainObject(values)) continue;

		for (const [fieldPath, value] of Object.entries(values)) {
			switch (operator) {
				case "$set":
					setPath(next, fieldPath, value);
					break;
				case "$inc": {
					const current = Number(getPath(next, fieldPath) || 0);
					setPath(next, fieldPath, current + Number(value));
					break;
				}
				case "$unset":
					unsetPath(next, fieldPath);
					break;
				case "$addToSet": {
					const current = getPath(next, fieldPath);
					const array = Array.isArray(current) ? current : [];
					if (!array.some((item) => deepEqual(item, value))) array.push(value);
					setPath(next, fieldPath, array);
					break;
				}
				case "$push": {
					const current = getPath(next, fieldPath);
					const array = Array.isArray(current) ? current : [];
					array.push(value);
					setPath(next, fieldPath, array);
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
	const result = {};

	for (const [field, value] of Object.entries(document || {})) {
		if (field === "_id" || field === "save") continue;
		if (field === "id" && !includeId) continue;
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
};

const createTransactionShim = () => ({
	startSession: async () => ({
		withTransaction: async (callback) => callback(),
		endSession: async () => {},
	}),
});

const createPrismaModel = (prisma, provider, config) => {
	const delegate = prisma[config.delegate];

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

		static async _fetch(filter = {}) {
			const where = getSimpleWhere(filter, config);
			const rows = where ? await delegate.findMany({ where }) : await delegate.findMany();
			return rows.map((row) => PrismaModel._hydrate(row)).filter((document) => matchesFilter(document, filter));
		}

		static async _saveDocument(document) {
			const source = addDefaults(clone(document), config);
			const data = prepareForPrisma(source, config, provider);
			let saved;

			if (source.id) {
				saved = await delegate.update({ where: { id: source.id }, data }).catch(async () => {
					return delegate.create({ data: prepareForPrisma(source, config, provider, true) });
				});
			} else {
				saved = await delegate.create({ data });
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
			const documents = await PrismaModel._fetch(filter);
			const matched = documents[0];
			const updateState = applyUpdate(matched || extractEqualityFields(filter), update);
			const shouldUpsert = options.upsert || updateState.upsertFromBody;

			if (!matched && !shouldUpsert) {
				return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
			}

			const saved = await PrismaModel._saveDocument(updateState.document);
			return {
				acknowledged: true,
				matchedCount: matched ? 1 : 0,
				modifiedCount: matched ? 1 : 0,
				upsertedCount: matched ? 0 : 1,
				upsertedId: matched ? null : saved.id,
			};
		}

		static async findOneAndUpdate(filter = {}, update = {}, options = {}) {
			const documents = await PrismaModel._fetch(filter);
			const matched = documents[0];

			if (!matched && !options.upsert) return null;

			const base = matched || extractEqualityFields(filter);
			const updateState = applyUpdate(base, update);
			const saved = await PrismaModel._saveDocument(updateState.document);
			return saved;
		}

		static async findByIdAndUpdate(id, update = {}, options = {}) {
			return PrismaModel.findOneAndUpdate({ id }, update, options);
		}
	}

	PrismaModel.db = createTransactionShim();
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
		api[name] = createPrismaModel(prisma, provider, config);
	}
	api.disconnect = () => prisma.$disconnect();
	return api;
};

const connectPrismaDatabase = async (provider) => {
	if (provider === "sqlite") {
		process.env.SQLITE_DATABASE_URL = normalizeSqliteUrl(process.env.SQLITE_DATABASE_URL || DEFAULT_SQLITE_URL);
		ensureSqliteFile(process.env.SQLITE_DATABASE_URL);
	}

	const PrismaClient = loadPrismaClient(provider);
	const options =
		provider === "sqlite" ?
			{ datasources: { db: { url: process.env.SQLITE_DATABASE_URL } } }
		:	{ datasources: { db: { url: process.env.MONGO } } };
	const prisma = new PrismaClient(options);

	await prisma.$connect();
	if (provider === "sqlite") await ensureSqliteSchema(prisma);

	return createDatabaseApi(prisma, provider);
};

module.exports = {
	connectPrismaDatabase,
};
