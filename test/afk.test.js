const assert = require("node:assert");
const { test } = require("node:test");
const { useHooks } = require("zihooks");
const loadTemp = require("../extensions/loadTemp.js");
const afkCommand = require("../commands/utility/afk.js");
const messageCreateEvent = require("../events/client/messageCreate.js");

test("loadTemp extension initializes empty afkCache when no DB or empty DB is present", async () => {
	// Setup mock hooks
	useHooks.set("logger", { debug: () => {}, error: () => {} });
	useHooks.set("temp", new Map());
	useHooks.set("db", null);

	await loadTemp.execute();

	const afkCache = useHooks.get("afkCache");
	assert.ok(afkCache instanceof Map);
	assert.strictEqual(afkCache.size, 0);
});

test("loadTemp extension populates afkCache with AFK users from DB", async () => {
	// Setup mock hooks
	useHooks.set("logger", { debug: () => {}, error: () => {} });
	useHooks.set("temp", new Map());

	const mockDb = {
		ZiGuild: {
			find: () => ({
				lean: async () => [],
			}),
		},
		ZiUser: {
			find: (query) => {
				assert.strictEqual(query.afk, true);
				return {
					lean: async () => [
						{
							userID: "12345",
							afk: true,
							afkReason: "Studying",
							afkTime: new Date("2026-06-19T10:00:00.000Z"),
						},
					],
				};
			},
		},
	};
	useHooks.set("db", mockDb);

	await loadTemp.execute();

	const afkCache = useHooks.get("afkCache");
	assert.ok(afkCache instanceof Map);
	assert.strictEqual(afkCache.size, 1);
	assert.ok(afkCache.has("12345"));
	assert.deepStrictEqual(afkCache.get("12345"), {
		afk: true,
		afkReason: "Studying",
		afkTime: new Date("2026-06-19T10:00:00.000Z"),
	});
});

test("afk command updates both database and afkCache", async () => {
	let dbUpdated = false;
	const mockDb = {
		ZiUser: {
			updateOne: async (filter, update) => {
				assert.strictEqual(filter.userID, "54321");
				assert.strictEqual(update.$set.afk, true);
				assert.strictEqual(update.$set.afkReason, "Sleeping");
				dbUpdated = true;
			},
		},
	};
	useHooks.set("db", mockDb);

	// Reset cache
	const afkCache = new Map();
	useHooks.set("afkCache", afkCache);

	let replied = false;
	const mockInteraction = {
		user: { id: "54321", username: "TestUser" },
		options: {
			getString: (name) => {
				if (name === "reason") return "Sleeping";
				return null;
			},
		},
		reply: async (options) => {
			assert.ok(options.embeds);
			replied = true;
		},
	};

	await afkCommand.execute({ interaction: mockInteraction });

	assert.strictEqual(dbUpdated, true);
	assert.ok(afkCache.has("54321"));
	assert.strictEqual(afkCache.get("54321").afk, true);
	assert.strictEqual(afkCache.get("54321").afkReason, "Sleeping");
	assert.strictEqual(replied, true);
});

test("messageCreate event handles returning AFK users using afkCache", async () => {
	let dbUpdated = false;
	const mockDb = {
		ZiUser: {
			updateOne: async (filter, update) => {
				assert.strictEqual(filter.userID, "99999");
				assert.strictEqual(update.$set.afk, false);
				dbUpdated = true;
			},
		},
	};
	useHooks.set("db", mockDb);

	const afkCache = new Map();
	afkCache.set("99999", {
		afk: true,
		afkReason: "Out for lunch",
		afkTime: new Date(Date.now() - 60000), // 1 minute ago
	});
	useHooks.set("afkCache", afkCache);

	let replied = false;
	const mockMessage = {
		client: {
			isReady: () => true,
		},
		author: {
			bot: false,
			id: "99999",
			username: "LunchGuy",
		},
		mentions: {
			users: new Map(),
		},
		reply: async (text) => {
			assert.ok(text.includes("Chào mừng bạn quay trở lại"));
			replied = true;
			return {
				delete: async () => {},
			};
		},
	};

	await messageCreateEvent.execute(mockMessage);

	assert.strictEqual(dbUpdated, true, "Database should be updated to set AFK false");
	assert.strictEqual(afkCache.has("99999"), false, "User should be removed from afkCache");
	assert.strictEqual(replied, true, "Should reply welcoming back the user");
});

test("messageCreate event checks mentioned users using afkCache", async () => {
	const afkCache = new Map();
	afkCache.set("11111", {
		afk: true,
		afkReason: "Coding",
		afkTime: new Date(Date.now() - 120000), // 2 minutes ago
	});
	useHooks.set("afkCache", afkCache);

	let replyCount = 0;
	const mockMessage = {
		client: {
			isReady: () => true,
		},
		author: {
			bot: false,
			id: "22222",
			username: "OtherGuy",
		},
		mentions: {
			users: new Map([
				["11111", { id: "11111", username: "Coder" }],
			]),
		},
		reply: async (text) => {
			assert.ok(text.includes("Coder"));
			assert.ok(text.includes("Coding"));
			replyCount++;
		},
	};

	await messageCreateEvent.execute(mockMessage);

	assert.strictEqual(replyCount, 1, "Should reply once for the mentioned AFK user");
	assert.strictEqual(afkCache.has("11111"), true, "Mentioned user should remain in afkCache");
});
