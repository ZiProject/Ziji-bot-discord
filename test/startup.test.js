const fs = require("node:fs");
const fsPromises = fs.promises;
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const { test } = require("node:test");
const { EventEmitter } = require("node:events");
const { Collection } = require("discord.js");
const { useHooks } = require("zihooks");

const { StartupManager, createWebApp } = require("../startup/index.js");
const { buildBuilderPreview, startBuilderSession } = require("../functions/guildCommand/guildCommandBuilder.js");

const createTempModule = async (dir, name, content) => {
	const filePath = path.join(dir, `${name}.js`);
	await fsPromises.writeFile(filePath, content, "utf8");
	return filePath;
};

const removeTempDir = async (dir) => {
	if (fs.existsSync(dir)) await fsPromises.rm(dir, { recursive: true, force: true });
};

const createTestManager = (client = { id: "test-client" }) => {
	class TestStartupManager extends StartupManager {
		initWeb() {
			return { server: null, wss: null };
		}

		initPlayerNet() {
			useHooks.set("playerNetClient", [this.client]);
		}

		createFile() {
			return null;
		}
	}

	return new TestStartupManager(client);
};

const buildCommandModules = async (dir) => {
	await createTempModule(
		dir,
		"validCommand",
		`module.exports = {
			data: { name: "foo" },
			execute: async () => "ok",
		};`,
	);

	await createTempModule(
		dir,
		"disabledCommand",
		`module.exports = {
			data: { name: "bar", enable: false },
			execute: async () => "should not load",
		};`,
	);

	await createTempModule(
		dir,
		"messageCommand",
		`module.exports = {
			data: { name: "baz", alias: ["bz"] },
			execute: async () => "ok",
			run: async () => "message",
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

test("StartupManager.loadModules uses @ziji/loader for commands and aliases", async () => {
	const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ziji-startup-test-"));
	try {
		useHooks.set("config", { disabledCommands: [] });
		const commands = new Collection();
		const mcommands = new Collection();
		useHooks.set("commands", commands);
		useHooks.set("Mcommands", mcommands);

		await buildCommandModules(tempDir);
		const manager = createTestManager();
		await manager.loadModules(tempDir, commands);

		assert.strictEqual(commands.has("foo"), true, "Expected valid command to be loaded");
		assert.strictEqual(commands.has("bar"), false, "Disabled command should not be loaded");
		assert.strictEqual(mcommands.has("baz"), true, "Message command should be registered");
		assert.strictEqual(mcommands.has("bz"), true, "Alias should be registered in Mcommands");
		assert.strictEqual(mcommands.get("bz").data.name, "baz");
	} finally {
		await removeTempDir(tempDir);
	}
});

test("StartupManager.loadModules loads actual command modules from commands folder", async () => {
	useHooks.set("config", require("../startup/defaultconfig"));
	const commands = new Collection();
	const mcommands = new Collection();
	useHooks.set("commands", commands);
	useHooks.set("Mcommands", mcommands);
	useHooks.set("functions", new Collection());

	const manager = createTestManager();
	const result = await manager.loadModules(path.join(__dirname, "..", "commands"), commands);

	assert.ok(result.loaded.length > 0, "Expected at least one actual command to be loaded");
	assert.ok(commands.size > 0, "Expected at least one actual command to be registered");
	assert.ok(commands.has("ping"), "Expected actual ping command to be loaded");
});

test("StartupManager.loadEvents attaches event handlers and executes fake events", async () => {
	const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ziji-startup-event-test-"));
	try {
		process.__ziji_test_on_count = 0;
		process.__ziji_test_once_count = 0;
		await buildEventModules(tempDir);

		const emitter = new EventEmitter();
		const manager = createTestManager();
		await manager.loadEvents(tempDir, emitter);

		emitter.emit("testOn");
		emitter.emit("testOn");
		emitter.emit("testOnce");
		emitter.emit("testOnce");
		await new Promise((resolve) => setImmediate(resolve));

		assert.strictEqual(process.__ziji_test_on_count, 2, "Expected on event to fire twice");
		assert.strictEqual(process.__ziji_test_once_count, 1, "Expected once event to fire only once");
	} finally {
		delete process.__ziji_test_on_count;
		delete process.__ziji_test_once_count;
		await removeTempDir(tempDir);
	}
});

test("StartupManager.initHooks initializes hooks and exposes config/logger", async () => {
	const fakeClient = { id: "fake-client" };
	const manager = createTestManager(fakeClient);
	manager.initHooks();

	assert.strictEqual(useHooks.get("client"), fakeClient, "Client hook should be initialized");
	assert.ok(useHooks.get("commands") instanceof Collection, "Commands hook should be a Collection");
	assert.ok(useHooks.get("functions") instanceof Collection, "Functions hook should be a Collection");
	assert.ok(useHooks.get("logger"), "Logger hook should be available");
	assert.deepStrictEqual(manager.getConfig(), useHooks.get("config"));
});

test("Hono web middleware handles JSON bodies, CORS, and preflight requests", async () => {
	const previousOrigin = process.env.CORS_ORIGIN;
	process.env.CORS_ORIGIN = "*";

	try {
		const app = createWebApp();
		app.post("/echo", (context) => context.json(context.get("body")));

		const response = await app.request("/echo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ok: true }),
		});
		assert.deepStrictEqual(await response.json(), { ok: true });
		assert.strictEqual(response.headers.get("Access-Control-Allow-Origin"), "*");
		assert.strictEqual(response.headers.get("Access-Control-Allow-Credentials"), "true");

		const preflight = await app.request("/echo", {
			method: "OPTIONS",
			headers: {
				Origin: "https://dashboard.example",
				"Access-Control-Request-Headers": "Authorization, X-Custom",
			},
		});
		assert.strictEqual(preflight.status, 204);
		assert.strictEqual(preflight.headers.get("Access-Control-Allow-Origin"), "https://dashboard.example");
		assert.strictEqual(preflight.headers.get("Access-Control-Allow-Methods"), "GET,POST,PUT,PATCH,DELETE,OPTIONS");
		assert.strictEqual(preflight.headers.get("Access-Control-Allow-Headers"), "Authorization, X-Custom");

		const malformedJson = await app.request("/echo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{",
		});
		assert.strictEqual(malformedJson.status, 400);

		const scalarJson = await app.request("/echo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify("scalar"),
		});
		assert.strictEqual(scalarJson.status, 400);
	} finally {
		if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
		else process.env.CORS_ORIGIN = previousOrigin;
	}
});

test("Bot API Hono routes preserve transcript access and auth responses", async () => {
	const app = createWebApp();
	useHooks.set("server", app);
	require("../extensions/routes/botApi.js").execute({ user: { id: "test-client" } });

	const transcripts = await app.request("/transcripts/");
	assert.strictEqual(transcripts.status, 403);
	assert.match(await transcripts.text(), /403 Forbidden/);

	const missingTranscript = await app.request("/transcripts/not-found.html");
	assert.strictEqual(missingTranscript.status, 404);

	const unauthenticated = await app.request("/user/settings");
	assert.strictEqual(unauthenticated.status, 401);
	assert.strictEqual(await unauthenticated.text(), "No token provided");
});

test("Guild command editor routes mount on Hono and require the session password for APIs", async () => {
	const app = createWebApp();
	const functions = new Collection();
	useHooks.set("server", app);
	useHooks.set("functions", functions);
	require("../extensions/routes/guildCommandWeb.js").execute({ guilds: { cache: new Collection() } });

	const { token } = functions.get("guildCommandWeb").createSession({
		name: "test_command",
		guildId: "guild-1",
		userId: "user-1",
	});
	const editor = await app.request(`/guildcommand/editor?token=${token}`);
	assert.strictEqual(editor.status, 200);
	const editorHtml = await editor.text();
	assert.match(editorHtml, /test_command/);
	assert.match(editorHtml, /guild-1/);

	const unauthorized = await app.request("/guildcommand/api/meta", {
		headers: { "x-editor-password": "wrong-password" },
	});
	assert.strictEqual(unauthorized.status, 401);
	assert.deepStrictEqual(await unauthorized.json(), { error: "Link hoặc mật khẩu không hợp lệ/hết hạn." });

	const unauthorizedSave = await app.request("/guildcommand/api/save", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token, password: "wrong-password" }),
	});
	assert.strictEqual(unauthorizedSave.status, 401);
});

test("Music and stream routes mount on Hono and retain validation responses", async () => {
	const app = createWebApp();
	useHooks.set("server", app);
	require("../extensions/routes/music.js").execute();
	require("../extensions/routes/stream.js").execute();

	const missingTrack = await app.request("/api/stream/audio");
	assert.strictEqual(missingTrack.status, 400);
	assert.strictEqual(await missingTrack.text(), "Bad Request");

	const invalidTrack = await app.request("/api/stream/video?trackData=%7B");
	assert.strictEqual(invalidTrack.status, 400);
	assert.deepStrictEqual(await invalidTrack.json(), { error: "Invalid trackData" });

	const missingProxyUrl = await app.request("/proxy/stream");
	assert.strictEqual(missingProxyUrl.status, 400);
	assert.deepStrictEqual(await missingProxyUrl.json(), { error: "Missing url or id parameter..." });
});

test("Guild command utility modules load through the supported public discord.js API", () => {
	assert.doesNotThrow(
		() => require("../functions/guildCommand/guildCommandManager"),
		"guildCommandManager should load without private discord.js internals",
	);
	assert.doesNotThrow(
		() => require("../functions/guildCommand/guildCommandBuilderActions"),
		"guildCommandBuilderActions should resolve its sibling builder module",
	);
});

test("Builder preview exposes add-section, add-buttons, and add-media actions", () => {
	const session = startBuilderSession({
		userId: "user-1",
		guildId: "guild-1",
		commandName: "builder_test",
		layout: { accentColor: [88, 101, 242], blocks: [{ type: "text", content: "Hello" }] },
	});

	const payload = buildBuilderPreview(session, {
		user: { id: "user-1", username: "tester" },
		guild: { id: "guild-1", name: "Test Guild", memberCount: 3 },
	});
	const serialized = JSON.stringify(payload);

	assert.ok(serialized.includes("B_guildcmd_addsection"), "Expected section add action to be present");
	assert.ok(serialized.includes("B_guildcmd_addbuttons"), "Expected buttons add action to be present");
	assert.ok(serialized.includes("B_guildcmd_addmedia"), "Expected media add action to be present");
});
