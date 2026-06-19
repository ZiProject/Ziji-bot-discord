const fs = require("node:fs");
const fsPromises = fs.promises;
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const { test } = require("node:test");
const { useHooks } = require("zihooks");

const { connectPrismaDatabase, _internals: prismaInternals } = require("../startup/prismaDB.js");

const removeTempDir = async (dir) => {
	if (fs.existsSync(dir)) {
		await fsPromises.rm(dir, { recursive: true, force: true });
	}
};
test("Prisma adapter keeps null JSON values instead of replacing them with defaults", async () => {
	const config = {
		defaults: {
			huntStats: {},
			userInfo: {},
			guilds: [],
			battleStats: { wins: 0, losses: 0, total: 0 },
		},
		jsonFields: ["huntStats", "userInfo", "guilds", "battleStats"],
	};

	const hydrated = prismaInternals.addDefaults(
		{
			huntStats: null,
			userInfo: null,
			guilds: null,
			battleStats: null,
		},
		config,
	);

	assert.strictEqual(hydrated.huntStats, null, "null JSON fields should remain null");
	assert.strictEqual(hydrated.userInfo, null, "null JSON fields should remain null");
	assert.strictEqual(hydrated.guilds, null, "null array fields should remain null");
	assert.strictEqual(hydrated.battleStats, null, "null JSON fields should remain null");
});

test("Prisma hydration fills missing fields without overwriting existing null values", () => {
	const config = {
		defaults: {
			level: 1,
			coin: 0,
			volume: 100,
			huntStats: {},
			guilds: [],
		},
		jsonFields: ["huntStats", "guilds"],
	};

	const row = {
		id: "doc-id",
		userID: "abc",
		huntStats: null,
		guilds: null,
		level: 1,
		coin: 5,
	};

	const hydrated = prismaInternals.hydrateRow(row, config, "sqlite", { _saveDocument: async () => null });

	assert.strictEqual(hydrated.huntStats, null, "stored null JSON values should not be replaced");
	assert.strictEqual(hydrated.guilds, null, "stored null array values should not be replaced");
	assert.strictEqual(hydrated.level, 1, "existing scalar values should be preserved");
	assert.strictEqual(hydrated.coin, 5, "existing scalar values should be preserved");
});

test("Prisma SQLite adapter exposes Mongoose-like model API", async () => {
	const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ziji-prisma-sqlite-test-"));
	const previousSqliteUrl = process.env.SQLITE_DATABASE_URL;
	let db;

	try {
		const sqlitePath = path.join(tempDir, "ziDB.sqlite").replace(/\\/g, "/");
		process.env.SQLITE_DATABASE_URL = `file:${sqlitePath}`;
		db = await connectPrismaDatabase("sqlite");

		const user = await db.ZiUser.findOneAndUpdate(
			{ userID: "adapter-user" },
			{
				$set: { name: "Adapter" },
				$inc: { coin: 10 },
				$addToSet: { thankedCookies: "cookie-1" },
			},
			{ upsert: true },
		);

		user.huntStats.common = { Cat: { count: 2 } };
		await user.save();

		const found = await db.ZiUser.findOne({
			userID: "adapter-user",
			"huntStats.common.Cat.count": { $gte: 2 },
		});
		const leanUsers = await db.ZiUser.find({}, { userID: 1, coin: 1 }).lean();

		assert.strictEqual(found.coin, 10);
		assert.strictEqual(found.thankedCookies.includes("cookie-1"), true);
		assert.strictEqual(found.huntStats.common.Cat.count, 2);
		assert.strictEqual(typeof leanUsers[0].save, "undefined");
		assert.strictEqual(leanUsers[0].userID, "adapter-user");
	} finally {
		if (db) await db.disconnect();
		if (previousSqliteUrl === undefined) delete process.env.SQLITE_DATABASE_URL;
		else process.env.SQLITE_DATABASE_URL = previousSqliteUrl;
		await removeTempDir(tempDir);
	}
});

test("client ready falls back to LocalDB when Prisma providers fail", async () => {
	const prismaDbPath = require.resolve("../startup/prismaDB.js");
	const readyEventPath = require.resolve("../events/client/ready.js");

	const previousPrismaCache = require.cache[prismaDbPath];
	const previousMongo = process.env.MONGO;

	let extensionExecuted = false;
	let statusSet = false;
	let activitySet = false;

	try {
		process.env.MONGO = "mongodb://localhost:27017/ziji";

		useHooks.set("config", {
			deploy: false,
			botConfig: {},
		});

		useHooks.set("logger", {
			error: () => {},
			info: () => {},
			warn: () => {},
			debug: () => {},
		});

		useHooks.set("extensions", [
			{
				data: {
					name: "test-extension",
					enable: true,
					priority: 1,
				},
				execute: async () => {
					extensionExecuted = true;
				},
			},
		]);

		delete require.cache[readyEventPath];

		require.cache[prismaDbPath] = {
			id: prismaDbPath,
			filename: prismaDbPath,
			loaded: true,
			exports: {
				connectPrismaDatabase: async () => {
					throw new Error("database failed");
				},
			},
		};

		const readyEvent = require("../events/client/ready.js");

		const fakeClient = {
			channels: {
				fetch: async () => null,
			},
			user: {
				tag: "Test#0001",
				setStatus() {
					statusSet = true;
				},
				setActivity() {
					activitySet = true;
				},
			},
		};

		await readyEvent.execute(fakeClient);

		assert.ok(useHooks.get("db"));

		assert.strictEqual(extensionExecuted, true);
		assert.strictEqual(statusSet, true);
		assert.strictEqual(activitySet, true);
	} finally {
		delete require.cache[readyEventPath];

		if (previousPrismaCache) require.cache[prismaDbPath] = previousPrismaCache;
		else delete require.cache[prismaDbPath];

		if (previousMongo === undefined) delete process.env.MONGO;
		else process.env.MONGO = previousMongo;
	}
});

test("Prisma Mongo adapter uses appName as database name when URI path is empty", () => {
	const mongoUrl = "mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority&appName=Divahost";

	const normalizedUrl = prismaInternals.normalizeMongoUrl(mongoUrl);

	assert.strictEqual(prismaInternals.getMongoDatabaseName(normalizedUrl), "Divahost");
	assert.strictEqual(
		normalizedUrl,
		"mongodb+srv://user:pass@example.mongodb.net/Divahost?retryWrites=true&w=majority&appName=Divahost",
	);
});

test("Prisma where builder treats empty filters as unconstrained queries", () => {
	const where = prismaInternals.getPrismaWhere({}, { fields: ["id", "userID"], jsonFields: [], dateFields: [] });

	assert.strictEqual(where, null, "Empty filters should not generate a Mongo where clause");
});

test("Prisma Mongo adapter rejects connection strings without database name or appName", () => {
	assert.throws(
		() => prismaInternals.normalizeMongoUrl("mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority"),
		/MONGO must include a database name/,
		"MongoDB connection strings must include a database path or appName fallback",
	);
});
