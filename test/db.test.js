const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { useHooks } = require("zihooks");

const { initDatabase, connectPrismaDatabase, _internals: prismaInternals } = require("../startup/prismaDB.js");

const removeTempDir = async (dir) => {
	if (fs.existsSync(dir)) await fs.promises.rm(dir, { recursive: true, force: true });
};

test("Prisma SQLite adapter persists and hydrates Mongoose-like documents", async () => {
	const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ziji-db-test-"));
	const previousSqliteUrl = process.env.SQLITE_DATABASE_URL;
	let db;

	try {
		process.env.SQLITE_DATABASE_URL = `file:${path.join(tempDir, "test.sqlite")}`;
		useHooks.set("logger", { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
		db = await connectPrismaDatabase("sqlite");

		const created = await db.ZiUser.create({ userID: "adapter-user", coin: 10, thankedCookies: ["cookie-1"], huntStats: { common: { Cat: { count: 2 } } } });
		assert.strictEqual(created.userID, "adapter-user");

		const found = await db.ZiUser.findOne({ userID: "adapter-user" });
		assert.strictEqual(found.coin, 10);
		assert.strictEqual(found.thankedCookies.includes("cookie-1"), true);
		assert.strictEqual(found.huntStats.common.Cat.count, 2);

		const leanUsers = await db.ZiUser.find({ userID: "adapter-user" }).lean();
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
	const previousDb = useHooks.get("db");
	const logger = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} };

	try {
		process.env.MONGO = "mongodb://localhost:27017/ziji";
		useHooks.set("config", { deploy: false, botConfig: {} });
		useHooks.set("logger", logger);
		useHooks.set("db", null);

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
			channels: { fetch: async () => null },
			user: {
				tag: "Test#0001",
				setStatus() {},
				setActivity() {},
			},
		};

		await readyEvent.execute(fakeClient);
		const db = await initDatabase({ client: fakeClient, logger });

		assert.ok(db, "initDatabase should return a fallback database");
		assert.strictEqual(db.provider, "localdb");
		assert.strictEqual(useHooks.get("db"), db);
		assert.ok(db.ZiUser);
		assert.ok(db.ZiGuild);
	} finally {
		delete require.cache[readyEventPath];
		if (previousPrismaCache) require.cache[prismaDbPath] = previousPrismaCache;
		else delete require.cache[prismaDbPath];
		if (previousMongo === undefined) delete process.env.MONGO;
		else process.env.MONGO = previousMongo;
		useHooks.set("db", previousDb);
	}
});

test("Prisma Mongo adapter uses appName as database name when URI path is empty", () => {
	const mongoUrl = "mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority&appName=Divahost";
	const normalizedUrl = prismaInternals.normalizeMongoUrl(mongoUrl);
	assert.strictEqual(prismaInternals.getMongoDatabaseName(normalizedUrl), "Divahost");
});

test("Prisma where builder treats empty filters as unconstrained queries", () => {
	const config = { fields: ["id", "userID"], jsonFields: [] };
	assert.strictEqual(prismaInternals.getPrismaWhere({}, config), null);
});

test("Prisma Mongo adapter rejects connection strings without database name or appName", () => {
	assert.throws(() => prismaInternals.normalizeMongoUrl("mongodb+srv://user:pass@example.mongodb.net/"), /database name/i);
});
