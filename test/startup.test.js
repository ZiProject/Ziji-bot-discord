const fs = require("node:fs");
const fsPromises = fs.promises;
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const { test } = require("node:test");
const { EventEmitter } = require("node:events");
const { Collection } = require("discord.js");
const { useHooks } = require("zihooks");

const { connectPrismaDatabase, _internals: prismaInternals } = require("../startup/prismaDB.js");
const { StartupLoader } = require("../startup/loader.js");
const { StartupManager } = require("../startup/index.js");

const createTempModule = async (dir, name, content) => {
	const filePath = path.join(dir, `${name}.js`);
	await fsPromises.writeFile(filePath, content, "utf8");
	return filePath;
};

const removeTempDir = async (dir) => {
	if (fs.existsSync(dir)) {
		await fsPromises.rm(dir, { recursive: true, force: true });
	}
};

const buildCommandModules = async (dir) => {
	await createTempModule(
		dir,
		"validCommand",
		`module.exports = {
			data: { name: "foo" },
			execute: async () => {
				return "ok";
			},
		};`,
	);

	await createTempModule(
		dir,
		"disabledCommand",
		`module.exports = {
			data: { name: "bar", enable: false },
			execute: async () => {
				return "should not load";
			},
		};`,
	);

	await createTempModule(
		dir,
		"messageCommand",
		`module.exports = {
			data: { name: "baz", alias: ["bz"] },
			execute: async () => {
				return "ok";
			},
			run: async () => {
				return "message";
			},
		};`,
	);
};

const buildEventModules = async (dir) => {
	await createTempModule(
		dir,
		"onEvent",
		`module.exports = {
			name: "testOn",
			once: false,
			execute: async () => {
				process.__ziji_test_on_count = (process.__ziji_test_on_count || 0) + 1;
			},
		};`,
	);

	await createTempModule(
		dir,
		"onceEvent",
		`module.exports = {
			name: "testOnce",
			once: true,
			execute: async () => {
				process.__ziji_test_once_count = (process.__ziji_test_once_count || 0) + 1;
			},
		};`,
	);
};

const createLoader = () => new StartupLoader(useHooks.get("config"), console);

test("StartupLoader.loadFiles loads valid commands and registers Mcommands aliases", async () => {
	const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ziji-startup-test-"));
	try {
		useHooks.set("config", { disabledCommands: [] });
		const commands = new Collection();
		const mcommands = new Collection();
		useHooks.set("commands", commands);
		useHooks.set("Mcommands", mcommands);

		await buildCommandModules(tempDir);

		const loader = createLoader();
		await loader.loadFiles(tempDir, commands);

		assert.strictEqual(commands.has("foo"), true, "Expected valid command to be loaded");
		assert.strictEqual(commands.has("bar"), false, "Disabled command should not be loaded");
		assert.strictEqual(mcommands.has("baz"), true, "Message command should be registered");
		assert.strictEqual(mcommands.has("bz"), true, "Alias should be registered in Mcommands");
		assert.strictEqual(mcommands.get("bz").data.name, "baz");
	} finally {
		await removeTempDir(tempDir);
	}
});

test("StartupLoader.loadFiles loads actual command modules from commands folder", async () => {
	useHooks.set("config", require("../startup/defaultconfig"));
	const commands = new Collection();
	const mcommands = new Collection();
	useHooks.set("commands", commands);
	useHooks.set("Mcommands", mcommands);
	useHooks.set("functions", new Collection());

	const loader = createLoader();
	await loader.loadFiles(path.join(__dirname, "..", "commands"), commands);

	assert.ok(commands.size > 0, "Expected at least one actual command to be loaded");
	assert.ok(commands.has("ping"), "Expected actual ping command to be loaded");
});

test("StartupLoader.loadEvents attaches event handlers and executes fake events", async () => {
	const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ziji-startup-event-test-"));
	try {
		process.__ziji_test_on_count = 0;
		process.__ziji_test_once_count = 0;

		await buildEventModules(tempDir);

		const emitter = new EventEmitter();
		const loader = createLoader();
		await loader.loadEvents(tempDir, emitter);

		emitter.emit("testOn");
		emitter.emit("testOn");
		emitter.emit("testOnce");
		emitter.emit("testOnce");

		assert.strictEqual(process.__ziji_test_on_count, 2, "Expected on event to fire twice");
		assert.strictEqual(process.__ziji_test_once_count, 1, "Expected once event to fire only once");
	} finally {
		delete process.__ziji_test_on_count;
		delete process.__ziji_test_once_count;
		await removeTempDir(tempDir);
	}
});

test("StartupManager.initHooks initializes hooks and exposes config/logger", async () => {
	class TestStartupManager extends StartupManager {
		initWeb() {
			return { server: null, wss: null };
		}

		createFile() {
			return null;
		}
	}

	const fakeClient = { id: "fake-client" };
	const manager = new TestStartupManager(fakeClient);
	manager.initHooks();

	assert.strictEqual(useHooks.get("client"), fakeClient, "Client hook should be initialized");
	assert.ok(useHooks.get("commands") instanceof Collection, "Commands hook should be a Collection");
	assert.ok(useHooks.get("functions") instanceof Collection, "Functions hook should be a Collection");
	assert.ok(useHooks.get("logger"), "Logger hook should be available");
	assert.deepStrictEqual(manager.getConfig(), useHooks.get("config"));
});

test("client ready fails startup when both Prisma providers fail", async () => {
	const prismaDbPath = require.resolve("../startup/prismaDB.js");
	const readyEventPath = require.resolve("../events/client/ready.js");
	const previousPrismaCache = require.cache[prismaDbPath];
	const previousMongo = process.env.MONGO;
	const logs = { errors: [], infos: [] };
	let extensionExecuted = false;
	let statusSet = false;
	let activitySet = false;

	try {
		process.env.MONGO = "mongodb://localhost:27017/ziji";
		useHooks.set("config", { deploy: false, botConfig: {} });
		useHooks.set("logger", {
			error: (message) => logs.errors.push(message),
			info: (message) => logs.infos.push(message),
			debug: () => {},
		});
		useHooks.set("extensions", [
			{
				data: { name: "db-extension", enable: true, priority: 1 },
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
				connectPrismaDatabase: async (provider) => {
					throw new Error(`${provider} failed`);
				},
			},
		};

		const readyEvent = require("../events/client/ready.js");
		const fakeClient = {
			channels: { fetch: async () => null },
			user: {
				tag: "Test#0001",
				setStatus: () => {
					statusSet = true;
				},
				setActivity: () => {
					activitySet = true;
				},
			},
		};

		await assert.rejects(
			() => readyEvent.execute(fakeClient),
			/Database initialization failed\. MongoDB: mongodb failed; SQLite: sqlite failed/,
		);

		assert.strictEqual(extensionExecuted, false, "Extensions should not load without a db hook");
		assert.strictEqual(statusSet, false, "Client status should not be set after DB startup failure");
		assert.strictEqual(activitySet, false, "Client activity should not be set after DB startup failure");
		assert.ok(logs.errors.some((message) => message.includes("MongoDB Prisma connection failed")));
		assert.ok(logs.errors.some((message) => message.includes("SQLite Prisma fallback failed")));
	} finally {
		delete require.cache[readyEventPath];
		if (previousPrismaCache) require.cache[prismaDbPath] = previousPrismaCache;
		else delete require.cache[prismaDbPath];
		if (previousMongo === undefined) delete process.env.MONGO;
		else process.env.MONGO = previousMongo;
	}
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

test("Prisma Mongo adapter uses appName as database name when URI path is empty", () => {
	const mongoUrl = "mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority&appName=Divahost";

	const normalizedUrl = prismaInternals.normalizeMongoUrl(mongoUrl);

	assert.strictEqual(prismaInternals.getMongoDatabaseName(normalizedUrl), "Divahost");
	assert.strictEqual(
		normalizedUrl,
		"mongodb+srv://user:pass@example.mongodb.net/Divahost?retryWrites=true&w=majority&appName=Divahost",
	);
});

test("Prisma Mongo adapter rejects connection strings without database name or appName", () => {
	assert.throws(
		() => prismaInternals.normalizeMongoUrl("mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority"),
		/MONGO must include a database name/,
		"MongoDB connection strings must include a database path or appName fallback",
	);
});
