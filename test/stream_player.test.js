const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { useHooks } = require("zihooks");

const { StartupManager, createWebApp } = require("../startup/index.js");

test("Web playback reuses the user's connected Discord player when available", async (t) => {
	const originalPort = process.env.SERVER_PORT;
	const originalJwtSecret = process.env.JWT_SECRET;
	const managerKey = Symbol.for("ziplayer.PlayerManager.instance");
	const originalManager = globalThis[managerKey];
	const hookKeys = ["logger", "server", "streamWss", "httpServer", "voiceStates", "functions"];
	const originalHooks = new Map(hookKeys.map((key) => [key, useHooks.get(key)]));
	const userId = "9876543210";
	const guildId = "guild-stream-test";
	const channelId = "voice-stream-test";
	const playerId = `${guildId}::${channelId}`;
	let createCount = 0;
	let playedQuery;
	let voiceConnectCount = 0;
	let webAudioConnection;
	const voiceChannel = {
		id: channelId,
		name: "Voice channel",
		isVoiceBased: () => true,
		permissionsFor: () => ({ has: (permission) => ["Connect", "Speak"].includes(permission) }),
	};
	const bot = {
		user: { id: "bot-id" },
		channels: { fetch: async () => voiceChannel },
	};
	const player = Object.assign(new EventEmitter(), {
		id: playerId,
		connection: { joinConfig: { channelId } },
		play: async (query, options) => {
			playedQuery = { query, options };
			return { track: { title: "Reused track", url: "https://example.test/track" } };
		},
		connect: async (connection) => {
			if (connection?.id === channelId) voiceConnectCount++;
			webAudioConnection = connection;
			return {
				id: connection.sessionId,
				disconnect: async () => true,
			};
		},
	});

	process.env.SERVER_PORT = "0";
	process.env.JWT_SECRET = "stream-player-test-secret";
	const web = StartupManager.prototype.initWeb.call({ logger: { debug() {}, info() {} } });
	const app = createWebApp();
	globalThis[managerKey] = {
		getPlayer: (id) => (id === playerId ? player : undefined),
		getPlayersInChannel: () => [player],
		create: async () => {
			createCount++;
			throw new Error("A second web player should not be created");
		},
	};
	useHooks.set("logger", { error() {}, warn() {} });
	useHooks.set("server", app);
	useHooks.set("streamWss", web.streamWss);
	useHooks.set("httpServer", web.httpServer);
	useHooks.set("voiceStates", new Map([[userId, { guildId, channelId }]]));
	useHooks.set("functions", new Map([["playerCreate", { getBot: async () => bot }]]));
	require("../extensions/routes/stream.js").execute();

	t.after(async () => {
		for (const webSocketServer of [web.wss, web.streamWss]) {
			for (const socket of webSocketServer.clients) socket.terminate();
			await new Promise((resolve) => webSocketServer.close(resolve));
		}
		if (web.httpServer.listening) await new Promise((resolve) => web.httpServer.close(resolve));
		if (originalPort === undefined) delete process.env.SERVER_PORT;
		else process.env.SERVER_PORT = originalPort;
		if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = originalJwtSecret;
		if (originalManager === undefined) delete globalThis[managerKey];
		else globalThis[managerKey] = originalManager;
		for (const [key, value] of originalHooks) useHooks.set(key, value);
		webAudioConnection?.destroy();
	});

	if (!web.httpServer.listening) await new Promise((resolve) => web.httpServer.once("listening", resolve));
	const token = require("jsonwebtoken").sign({ id: userId }, process.env.JWT_SECRET, { algorithm: "HS256" });
	const response = await app.request("/api/stream/play", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ query: "test track", target: "auto" }),
	});

	assert.equal(response.status, 200);
	assert.equal(createCount, 0);
	assert.deepEqual(playedQuery, { query: "test track", options: { requestedBy: userId } });
	assert.equal(webAudioConnection?.sessionId, `web-stream-${userId}`);
	assert.deepEqual(await response.json(), {
		sessionId: `web-stream-${userId}`,
		playerId,
		target: "discord",
		track: { title: "Reused track", url: "https://example.test/track" },
	});

	const voiceResponse = await app.request("/api/stream/output", {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ mode: "voice" }),
	});
	assert.equal(voiceResponse.status, 200);
	assert.equal(voiceConnectCount, 0, "The already-connected Discord player must not join voice again");
});
