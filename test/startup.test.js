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
			return { server: null, httpServer: null, wss: null };
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
	assert.strictEqual(useHooks.get("httpServer"), manager.web.httpServer, "HTTP server hook should be available");
	assert.deepStrictEqual(manager.getConfig(), useHooks.get("config"));
});

test("StartupManager routes legacy and stream WebSocket paths separately", async (t) => {
	const originalPort = process.env.SERVER_PORT;
	process.env.SERVER_PORT = "0";
	const web = StartupManager.prototype.initWeb.call({
		logger: { debug() {}, info() {} },
	});
	t.after(async () => {
		for (const webSocketServer of [web.wss, web.streamWss]) {
			for (const socket of webSocketServer.clients) socket.terminate();
			await new Promise((resolve) => webSocketServer.close(resolve));
		}
		if (web.httpServer.listening) {
			await new Promise((resolve) => web.httpServer.close(resolve));
		}
		if (originalPort === undefined) delete process.env.SERVER_PORT;
		else process.env.SERVER_PORT = originalPort;
	});

	if (!web.httpServer.listening) {
		await new Promise((resolve) => web.httpServer.once("listening", resolve));
	}
	const { port } = web.httpServer.address();
	const WebSocket = require("ws");
	const connect = (pathname) =>
		new Promise((resolve, reject) => {
			const socket = new WebSocket(`ws://127.0.0.1:${port}${pathname}`);
			socket.once("open", () => resolve(socket));
			socket.once("error", reject);
		});
	const [voiceSocket, streamSocket] = await Promise.all([connect("/ws"), connect("/ws/stream")]);

	assert.strictEqual(web.wss.clients.size, 1);
	assert.strictEqual(web.streamWss.clients.size, 1);
	voiceSocket.close();
	streamSocket.close();
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

test("Root API routes load with the installed simple-git export", async () => {
	const app = createWebApp();
	const client = {
		user: {
			id: "test-client",
			displayName: "Test Bot",
			displayAvatarURL: () => "https://example.com/avatar.png",
		},
		isReady: () => true,
	};
	useHooks.set("server", app);
	useHooks.set("config", { botConfig: {} });
	useHooks.set("playerNetClient", [client]);
	require("../extensions/routes/index.js").execute(client);

	const root = await app.request("/", { headers: { Accept: "application/json" } });
	assert.strictEqual(root.status, 200);
	const rootData = await root.json();
	assert.strictEqual(rootData.status, "OK");
	assert.strictEqual(rootData.clientId, "test-client");

	const health = await app.request("/api/health");
	assert.strictEqual(health.status, 200);
	assert.deepStrictEqual(await health.json(), { status: "ok" });
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

test("Music and stream routes mount on Hono and require JWTs for ZiPlayer streaming", async (t) => {
	const app = createWebApp();
	const originalJwtSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "startup-test-secret";
	t.after(() => {
		if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalJwtSecret;
	});
	useHooks.set("server", app);
	useHooks.set("streamWss", new EventEmitter());
	useHooks.set("httpServer", { address: () => null });
	require("../extensions/routes/music.js").execute();
	require("../extensions/routes/stream.js").execute();

	const unauthenticatedPlay = await app.request("/api/stream/play", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query: "lofi" }),
	});
	assert.strictEqual(unauthenticatedPlay.status, 401);

	const invalidTokenState = await app.request("/api/stream/state", {
		headers: { Authorization: "Bearer invalid" },
	});
	assert.strictEqual(invalidTokenState.status, 401);

	const token = require("jsonwebtoken").sign({ id: "1234567890" }, process.env.JWT_SECRET, { algorithm: "HS256" });
	const invalidQuery = await app.request("/api/stream/play", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ query: " " }),
	});
	assert.strictEqual(invalidQuery.status, 400);

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

test("ZiPlayer stream state publishes initial and updated state as authenticated SSE", async (t) => {
	const app = createWebApp();
	const originalJwtSecret = process.env.JWT_SECRET;
	const managerKey = Symbol.for("ziplayer.PlayerManager.instance");
	const originalManager = globalThis[managerKey];
	process.env.JWT_SECRET = "stream-state-test-secret";
	const listeners = new Map();
	let unsubscribeCount = 0;
	const player = {
		currentTrack: { title: "Test track", duration: 60_000 },
		upcomingTracks: [],
		volume: 75,
		isPaused: false,
		loop: () => "off",
		autoPlay: () => false,
		getTime: () => ({ current: 12_345 }),
		subscribe: (eventName, listener) => {
			listeners.set(eventName, listener);
			return () => {
				unsubscribeCount++;
				listeners.delete(eventName);
			};
		},
	};
	globalThis[managerKey] = { getPlayer: (id) => (id === "web-stream-1234567890" ? player : null) };
	useHooks.set("server", app);
	useHooks.set("streamWss", new EventEmitter());
	require("../extensions/routes/stream.js").execute();
	t.after(() => {
		if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalJwtSecret;
		if (originalManager === undefined) delete globalThis[managerKey];
		else globalThis[managerKey] = originalManager;
	});

	const token = require("jsonwebtoken").sign({ id: "1234567890" }, process.env.JWT_SECRET, { algorithm: "HS256" });
	const response = await app.request("/api/stream/state", {
		headers: { Authorization: `Bearer ${token}` },
	});

	assert.strictEqual(response.status, 200);
	assert.match(response.headers.get("content-type"), /^text\/event-stream/);
	assert.strictEqual(response.headers.get("connection"), "keep-alive");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffered = "";
	const readUntil = async (marker) => {
		while (!buffered.includes(marker)) {
			const { value, done } = await reader.read();
			assert.strictEqual(done, false, "SSE stream should remain open");
			buffered += decoder.decode(value, { stream: true });
		}
		const markerIndex = buffered.indexOf(marker);
		const message = buffered.slice(0, markerIndex + marker.length);
		buffered = buffered.slice(markerIndex + marker.length);
		return message;
	};

	const initialEvent = await readUntil("\n\n");
	assert.match(initialEvent, /event: player-state/);
	const initialState = JSON.parse(initialEvent.match(/data: (.+)/)[1]);
	assert.strictEqual(initialState.timestamp, 12_345);
	assert.strictEqual(initialState.currentTrack.title, "Test track");
	assert.strictEqual(listeners.size, 14);

	player.currentTrack = { title: "Updated track", duration: 90_000 };
	player.getTime = () => ({ current: 23_456 });
	listeners.get("TRACK_STARTED")();
	const updatedEvent = await readUntil("\n\n");
	assert.match(updatedEvent, /event: player-state/);
	const updatedState = JSON.parse(updatedEvent.match(/data: (.+)/)[1]);
	assert.strictEqual(updatedState.timestamp, 23_456);
	assert.strictEqual(updatedState.currentTrack.title, "Updated track");

	await reader.cancel();
	await new Promise((resolve) => setImmediate(resolve));
	assert.strictEqual(unsubscribeCount, 14);
});

test("ZiPlayer stream output switches between browser and the user's Discord voice channel", async (t) => {
	const app = createWebApp();
	const originalJwtSecret = process.env.JWT_SECRET;
	const managerKey = Symbol.for("ziplayer.PlayerManager.instance");
	const originalManager = globalThis[managerKey];
	process.env.JWT_SECRET = "stream-output-test-secret";
	const playerId = "web-stream-1234567890";
	const channel = {
		id: "voice-channel",
		name: "Voice",
		isVoiceBased: () => true,
		permissionsFor: () => ({ has: (permission) => ["Connect", "Speak"].includes(permission) }),
	};
	const bot = {
		user: { id: "bot-id" },
		channels: { fetch: async () => channel },
	};
	let connection = null;
	let connectedWith = null;
	let disconnectCount = 0;
	const player = {
		userdata: { webAudioStream: { userId: "1234567890" } },
		get connection() {
			return connection;
		},
		connect: async (target, options) => {
			connectedWith = { target, options };
			connection = {};
			return connection;
		},
		disconnect: async () => {
			disconnectCount++;
			connection = null;
		},
	};
	globalThis[managerKey] = { getPlayer: (id) => (id === playerId ? player : null) };
	const functions = new Collection([["playerCreate", { getBot: async () => bot }]]);
	useHooks.set("server", app);
	useHooks.set("functions", functions);
	useHooks.set("voiceStates", new Map([["1234567890", { guildId: "guild-id", channelId: channel.id, channel }]]));
	useHooks.set("streamWss", new EventEmitter());
	require("../extensions/routes/stream.js").execute();
	t.after(() => {
		if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalJwtSecret;
		if (originalManager === undefined) delete globalThis[managerKey];
		else globalThis[managerKey] = originalManager;
	});

	const token = require("jsonwebtoken").sign({ id: "1234567890" }, process.env.JWT_SECRET, { algorithm: "HS256" });
	const request = (mode) =>
		app.request("/api/stream/output", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify({ mode }),
		});

	const voiceResponse = await request("voice");
	assert.strictEqual(voiceResponse.status, 200);
	assert.deepStrictEqual(await voiceResponse.json(), {
		sessionId: playerId,
		mode: "voice",
		channel: { id: channel.id, name: channel.name },
	});
	assert.deepStrictEqual(connectedWith, { target: channel, options: { group: bot.user.id } });
	assert.strictEqual(player.userdata.voiceChannel, channel);
	assert.strictEqual(player.userdata.channel, channel);

	const webResponse = await request("web");
	assert.strictEqual(webResponse.status, 200);
	assert.deepStrictEqual(await webResponse.json(), { sessionId: playerId, mode: "web" });
	assert.strictEqual(disconnectCount, 1);
	assert.strictEqual(player.userdata.voiceChannel, undefined);
});

test("ZiPlayer WebSocket listener authenticates with the existing JWT", async (t) => {
	const originalPort = process.env.SERVER_PORT;
	const originalJwtSecret = process.env.JWT_SECRET;
	process.env.SERVER_PORT = "0";
	process.env.JWT_SECRET = "stream-ws-test-secret";
	const web = StartupManager.prototype.initWeb.call({
		logger: { debug() {}, info() {} },
	});
	const app = createWebApp();
	useHooks.set("logger", { warn() {}, error() {} });
	useHooks.set("server", app);
	useHooks.set("streamWss", web.streamWss);
	useHooks.set("httpServer", web.httpServer);
	require("../extensions/routes/stream.js").execute();
	t.after(async () => {
		for (const webSocketServer of [web.wss, web.streamWss]) {
			for (const socket of webSocketServer.clients) socket.terminate();
			await new Promise((resolve) => webSocketServer.close(resolve));
		}
		if (web.httpServer.listening) {
			await new Promise((resolve) => web.httpServer.close(resolve));
		}
		if (originalPort === undefined) delete process.env.SERVER_PORT;
		else process.env.SERVER_PORT = originalPort;
		if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalJwtSecret;
	});

	if (!web.httpServer.listening) {
		await new Promise((resolve) => web.httpServer.once("listening", resolve));
	}
	const WebSocket = require("ws");
	const streamUrl = `ws://127.0.0.1:${web.httpServer.address().port}/ws/stream`;
	const connect = async () => {
		const socket = new WebSocket(streamUrl);
		await new Promise((resolve, reject) => {
			socket.once("open", resolve);
			socket.once("error", reject);
		});
		return socket;
	};
	const receiveMessage = (socket) =>
		new Promise((resolve, reject) => {
			const onMessage = (message, isBinary) => {
				socket.off("error", onError);
				resolve({ message, isBinary });
			};
			const onError = (error) => {
				socket.off("message", onMessage);
				reject(error);
			};
			socket.once("message", onMessage);
			socket.once("error", onError);
		});
	const jwt = require("jsonwebtoken");
	const sessionId = "web-stream-1234567890";
	const listener = await connect();
	let listenerMessageCount = 0;
	listener.on("message", () => listenerMessageCount++);
	const token = jwt.sign({ id: "1234567890" }, process.env.JWT_SECRET, { algorithm: "HS256" });
	listener.send(JSON.stringify({ type: "auth", token }));

	const publisher = await connect();
	const publisherReady = receiveMessage(publisher);
	const publisherToken = jwt.sign({ id: "1234567890", role: "publisher", sessionId }, process.env.JWT_SECRET, {
		algorithm: "HS256",
	});
	publisher.send(JSON.stringify({ type: "auth", token: publisherToken }));
	assert.deepStrictEqual(JSON.parse((await publisherReady).message.toString()), { type: "stream:publisher:ready", sessionId });

	const audioConfig = {
		v: 1,
		type: "audio:config",
		sessionId,
		protocolVersion: 1,
		codec: "opus",
		sampleRateHz: 48_000,
		channels: 2,
	};
	const listenerConfig = receiveMessage(listener);
	publisher.send(JSON.stringify(audioConfig));
	assert.deepStrictEqual(JSON.parse((await listenerConfig).message.toString()), audioConfig);
	assert.strictEqual(
		listenerMessageCount,
		1,
		"Listener should only receive the Opus configuration, not an unsupported ready message",
	);

	const frame = Buffer.from([0x5a, 0x49, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x00]);
	const listenerFrame = receiveMessage(listener);
	publisher.send(frame);
	const receivedFrame = await listenerFrame;
	assert.strictEqual(receivedFrame.isBinary, true);
	assert.deepStrictEqual(receivedFrame.message, frame);
	listener.close();
	publisher.close();
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
