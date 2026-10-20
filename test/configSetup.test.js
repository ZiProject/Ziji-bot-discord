const fs = require("node:fs");
const fsPromises = fs.promises;
const path = require("node:path");
const assert = require("node:assert");
const { test } = require("node:test");
const { useHooks } = require("zihooks");
const { Hono } = require("hono");
const { StartupManager, createWebApp } = require("../startup/index.js");

test("StartupManager auto-copies defaultconfig.js when config.js is missing", async (t) => {
	const rootDir = path.resolve(__dirname, "..");
	const configPath = path.join(rootDir, "config.js");
	const backupPath = path.join(rootDir, "config.js.backup-test");

	const hasOriginal = fs.existsSync(configPath);
	if (hasOriginal) {
		await fsPromises.rename(configPath, backupPath);
	}

	t.after(async () => {
		if (fs.existsSync(backupPath)) {
			if (fs.existsSync(configPath)) {
				await fsPromises.unlink(configPath).catch(() => {});
			}
			await fsPromises.rename(backupPath, configPath);
		}
	});

	assert.strictEqual(fs.existsSync(configPath), false, "config.js should be absent initially");

	class TestStartupManager extends StartupManager {
		initWeb() {
			return { server: null, httpServer: null, wss: null };
		}
		initPlayerNet() {}
		createFile() {}
	}

	const manager = new TestStartupManager({ id: "test-client" });
	assert.strictEqual(fs.existsSync(configPath), true, "config.js should be automatically created");

	const loadedConfig = manager.getConfig();
	assert.ok(loadedConfig, "Config should be loaded");
	assert.ok(loadedConfig.prefix, "Default prefix should be present");
});

test("Config setup route blocks non-localhost requests with 403 Forbidden without affecting other routes", async () => {
	const app = createWebApp();
	// Add other app routes
	app.get("/", (c) => c.text("home page"));
	app.get("/api/stream", (c) => c.json({ stream: "active" }));

	useHooks.set("server", app);
	useHooks.set("config", { prefix: "z!", botConfig: { Status: "online" } });

	const configRoute = require("../extensions/routes/configSetup.js");
	configRoute.execute({ user: { id: "test-bot" } });

	// Remote IP on /config and /api/config should be blocked
	const apiRes = await app.request("/api/config", {
		headers: {
			"x-test-ip": "192.168.1.100",
			Accept: "application/json",
		},
	});
	assert.strictEqual(apiRes.status, 403, "Remote IP should be blocked from API");
	const apiJson = await apiRes.json();
	assert.strictEqual(apiJson.status, "FORBIDDEN");

	const htmlRes = await app.request("/config", {
		headers: {
			"x-test-ip": "192.168.1.100",
		},
	});
	assert.strictEqual(htmlRes.status, 403, "Remote IP should be blocked from HTML page");
	const htmlText = await htmlRes.text();
	assert.ok(htmlText.includes("403 Forbidden"));

	// Remote IP on other routes (e.g. / and /api/stream) MUST NOT be blocked!
	const homeRes = await app.request("/", {
		headers: {
			"x-test-ip": "192.168.1.100",
		},
	});
	assert.strictEqual(homeRes.status, 200, "Home route should not be blocked");
	assert.strictEqual(await homeRes.text(), "home page");

	const streamRes = await app.request("/api/stream", {
		headers: {
			"x-test-ip": "192.168.1.100",
		},
	});
	assert.strictEqual(streamRes.status, 200, "Stream route should not be blocked");
	assert.deepStrictEqual(await streamRes.json(), { stream: "active" });
});

test("Config setup route allows localhost requests and reads/updates config", async (t) => {
	const app = createWebApp();
	const rootDir = path.resolve(__dirname, "..");
	const configPath = path.join(rootDir, "config.js");
	const backupPath = path.join(rootDir, "config.js.backup-route-test");

	if (fs.existsSync(configPath)) {
		await fsPromises.copyFile(configPath, backupPath);
	}

	t.after(async () => {
		if (fs.existsSync(backupPath)) {
			await fsPromises.copyFile(backupPath, configPath);
			await fsPromises.unlink(backupPath).catch(() => {});
		}
	});

	const initialConfig = {
		prefix: "z!",
		defaultCooldownDuration: 5000,
		PlayerConfig: { pauseOnEmpty: true, leaveOnEmpty: true },
		playerConfig: { auto_leave_empty_voice: true },
		botConfig: {
			Status: "idle",
			ActivityName: "/help",
			ActivityType: "PLAYING",
		},
	};
	useHooks.set("server", app);
	useHooks.set("config", initialConfig);

	const configRoute = require("../extensions/routes/configSetup.js");
	configRoute.execute({
		user: {
			id: "test-bot",
			setPresence: () => {},
		},
		isReady: () => true,
	});

	// Localhost GET /api/config
	const getRes = await app.request("/api/config", {
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
		},
	});
	assert.strictEqual(getRes.status, 200);
	const getData = await getRes.json();
	assert.strictEqual(getData.status, "OK");
	assert.strictEqual(getData.config.prefix, "z!");

	// Localhost GET /config (HTML UI)
	const htmlRes = await app.request("/config", {
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
		},
	});
	assert.strictEqual(htmlRes.status, 200);
	const htmlText = await htmlRes.text();
	assert.ok(htmlText.includes("Cài đặt cấu hình"));
	assert.ok(htmlText.includes("Localhost"));

	// Localhost POST /api/config (Update)
	const updateRes = await app.request("/api/config", {
		method: "POST",
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			prefix: "test!",
			botConfig: {
				Status: "online",
			},
		}),
	});
	assert.strictEqual(updateRes.status, 200);
	const updateData = await updateRes.json();
	assert.strictEqual(updateData.status, "OK");
	assert.strictEqual(updateData.config.prefix, "test!");
	assert.strictEqual(updateData.config.botConfig.Status, "online");
	assert.strictEqual(updateData.config.PlayerConfig.leaveOnEmpty, false);
	assert.strictEqual(updateData.config.PlayerConfig.pauseOnEmpty, true);
	assert.strictEqual("playerConfig" in updateData.config, false);

	// Verify updated in useHooks
	const hookConfig = useHooks.get("config");
	assert.strictEqual(hookConfig.prefix, "test!");

	// Verify written to config.js file
	assert.strictEqual(fs.existsSync(configPath), true);
	const fileContent = await fsPromises.readFile(configPath, "utf8");
	assert.ok(fileContent.includes('"prefix": "test!"'));

	// Validation check: empty prefix
	const invalidRes = await app.request("/api/config", {
		method: "POST",
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ prefix: "" }),
	});
	assert.strictEqual(invalidRes.status, 400);

	// Reset check: POST /api/config/reset
	const resetRes = await app.request("/api/config/reset", {
		method: "POST",
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
		},
	});
	assert.strictEqual(resetRes.status, 200);
	const resetData = await resetRes.json();
	assert.strictEqual(resetData.status, "OK");
	assert.strictEqual(resetData.config.prefix, "z!");
});

test("Config setup route works over real HTTP socket connection from 127.0.0.1", async (t) => {
	const { createServer } = require("node:http");
	const { getRequestListener } = require("@hono/node-server");

	const app = createWebApp();
	useHooks.set("server", app);
	useHooks.set("config", { prefix: "z!", botConfig: { Status: "online" } });

	const configRoute = require("../extensions/routes/configSetup.js");
	configRoute.execute({ user: { id: "test-bot" } });

	const server = createServer(getRequestListener(app.fetch));
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));

	const port = server.address().port;
	const response = await fetch(`http://127.0.0.1:${port}/api/config`);
	assert.strictEqual(response.status, 200);
	const data = await response.json();
	assert.strictEqual(data.status, "OK");
	assert.strictEqual(data.config.prefix, "z!");
});

test("Config setup form exposes the default config fields", async () => {
	const app = createWebApp();
	useHooks.set("server", app);
	useHooks.set("config", { ...require("../startup/defaultconfig.js"), DefaultLang: "en", disabledCommands: ["play"] });
	useHooks.set("commands", [{ data: { name: "play" } }, { data: { name: "stop" } }]);

	const configRoute = require("../extensions/routes/configSetup.js");
	configRoute.execute({ user: { id: "test-bot" } });

	const response = await app.request("/config", {
		headers: {
			"x-test-ip": "127.0.0.1",
			Host: "localhost:2003",
		},
	});
	assert.strictEqual(response.status, 200);

	const html = await response.text();
	const expectedFields = [
		"prefix",
		"Moptions",
		"defaultCooldownDuration",
		"defaultColorMode",
		"defaultColorPicker",
		"deploy",
		"ImageSearch",
		"defaultLang",
		"ownerSearch",
		"guildSearch",
		"disabledCommands",
		"botStatus",
		"activityType",
		"activityName",
		"banner",
		"webBackground",
		"errorLog",
		"feedback",
		"supportServer",
		"inviteBot",
		"dashboardUrl",
		"musicControllerUrl",
		"statusUrl",
		"playerVolumeMode",
		"playerVolume",
		"leaveOnEndCooldown",
		"playerSelfDeaf",
		"playerLeaveOnEnd",
		"playerChangeStatus",
		"pauseOnEmpty",
		"errorLogSearch",
		"feedbackSearch",
		"errorLogSearchResults",
		"feedbackSearchResults",
		"djsDebug",
		"playerDebug",
		"debugLevel",
		"voiceExtDebug",
		"prismaDebug",
		"loaderDebug",
		"giveawayEnabled",
		"autoResponderEnabled",
		"ticketEnabled",
		"welcomerEnabled",
		"aiEnabled",
		"aiAutoPlayEnabled",
		"guildCommandEnabled",
		"loggerLevel",
	];
	for (const field of expectedFields) {
		assert.ok(html.includes(`id="${field}"`), `Form should expose ${field}`);
	}
	assert.ok(html.includes('<option value="play"'), "Command options should come from the commands hook");
	assert.match(html, /<option value="en" selected>English \(en\)<\/option>/);
	assert.match(html, /<option value="ja"\s*>日本語 \(ja\)<\/option>/);
	assert.match(html, /<option value="play" selected>play<\/option>/, "Disabled commands should match canonical command names");
	assert.ok(html.includes("Disabled commands / Lệnh bị vô hiệu hóa / 無効にするコマンド"));
	assert.ok(!html.includes('id="autoLeaveEmptyVoice"'), "Deprecated auto-leave form field should be removed");
	assert.ok(!html.includes('"playerConfig":'), "Setup JSON should not contain the deprecated second player config");
	assert.match(html, /<label class="flex items-center justify-between[^"]*cursor-pointer">[\s\S]*?id="djsDebug"/);
	assert.match(html, /<label class="flex items-center justify-between[^"]*cursor-pointer">[\s\S]*?id="playerDebug"/);
	assert.match(html, /<label class="flex items-center justify-between[^"]*cursor-pointer">[\s\S]*?id="voiceExtDebug"/);
	assert.ok(html.includes("document.addEventListener('input', syncAdvancedFormChanges)"));
	assert.ok(html.includes("document.addEventListener('change', syncAdvancedFormChanges)"));
	const playerConfig = require("../startup/defaultconfig.js").PlayerConfig;
	assert.strictEqual(playerConfig.pauseOnEmpty, true);
	assert.deepStrictEqual(require("../config.js.example").PlayerConfig, playerConfig);
	const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
	assert.ok(inlineScripts.length > 0, "Setup page should include an inline script");
	for (const [, script] of inlineScripts) {
		assert.doesNotThrow(() => new Function(script), "Inline script should parse");
	}
});

test("Config setup lookups resolve users and guilds through the client", async () => {
	const app = createWebApp();
	const cachedUser = { id: "11111111111111111", username: "cached-user", globalName: "Cached User" };
	const fetchedUser = { id: "22222222222222222", username: "fetched-user", globalName: "Fetched User" };
	const channel = {
		id: "44444444444444444",
		name: "bot-logs",
		guild: { name: "Developer Server" },
		isTextBased: () => true,
		isSendable: () => true,
	};
	const guild = {
		id: "33333333333333333",
		name: "Developer Server",
		members: { cache: new Map([[cachedUser.id, { user: cachedUser }]]) },
		channels: { cache: new Map([[channel.id, channel]]) },
	};
	const client = {
		users: {
			cache: new Map(),
			fetch: async (id) =>
				id === fetchedUser.id ? fetchedUser : Promise.reject(Object.assign(new Error("Unknown User"), { code: 10013 })),
		},
		channels: { cache: new Map(), fetch: async () => channel },
		guilds: { cache: new Map([[guild.id, guild]]) },
	};
	useHooks.set("server", app);
	useHooks.set("config", {});

	require("../extensions/routes/configSetup.js").execute(client);

	const lookup = async (query) => {
		const response = await app.request(`/api/config/lookups?q=${query}`, {
			headers: { "x-test-ip": "127.0.0.1", Host: "localhost:2003" },
		});
		assert.strictEqual(response.status, 200);
		return response.json();
	};

	const userResults = await lookup("Cached");
	assert.deepStrictEqual(userResults.users, [{ id: cachedUser.id, label: "Cached User" }]);

	const fetchedResults = await lookup(fetchedUser.id);
	assert.deepStrictEqual(fetchedResults.users, [{ id: fetchedUser.id, label: "Fetched User" }]);

	const guildResults = await lookup("Developer");
	assert.deepStrictEqual(guildResults.guilds, [{ id: guild.id, label: guild.name }]);

	const channelResults = await lookup("bot-logs");
	assert.deepStrictEqual(channelResults.channels, [{ id: channel.id, label: "Developer Server / #bot-logs" }]);

	const fetchedChannelResults = await lookup(channel.id);
	assert.deepStrictEqual(fetchedChannelResults.channels, [{ id: channel.id, label: "Developer Server / #bot-logs" }]);
});
