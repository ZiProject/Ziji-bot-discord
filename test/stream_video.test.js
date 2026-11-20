const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const test = require("node:test");
const { useHooks } = require("zihooks");

const { createWebApp } = require("../startup/index.js");

test("/api/stream/video aborts and destroys underlying stream when client disconnects", async (t) => {
	const managerKey = Symbol.for("ziplayer.PlayerManager.instance");
	const originalManager = globalThis[managerKey];
	const hookKeys = ["logger", "server", "streamWss"];
	const originalHooks = new Map(hookKeys.map((key) => [key, useHooks.get(key)]));

	let destroyCalled = false;
	const sourceStream = new Readable({
		read() {
			this.push(Buffer.alloc(1024, "a"));
		},
	});
	sourceStream.metadata = {
		mime: "video/mp4",
		contentLength: "1048576",
	};
	sourceStream.destroyStream = () => {
		destroyCalled = true;
	};

	let saveVideoSignal;
	const mockPlayer = {
		saveVideo: async (trackData, options) => {
			saveVideoSignal = options?.signal;
			return sourceStream;
		},
	};

	const mockManager = {
		getPlayer: () => mockPlayer,
		create: async () => mockPlayer,
	};
	globalThis[managerKey] = mockManager;

	const app = createWebApp();
	useHooks.set("server", app);
	useHooks.set("streamWss", new EventEmitter());
	useHooks.set("logger", { debug() {}, info() {}, error() {} });

	const streamModule = require("../extensions/routes/stream.js");
	streamModule.execute();

	t.after(() => {
		globalThis[managerKey] = originalManager;
		for (const [key, val] of originalHooks) {
			if (val === undefined) useHooks.delete(key);
			else useHooks.set(key, val);
		}
	});

	const abortController = new AbortController();
	const response = await app.request("/api/stream/video?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
		headers: {
			Range: "bytes=0-100000",
		},
		signal: abortController.signal,
	});

	assert.equal(response.status, 206);
	assert.equal(response.headers.get("content-range"), "bytes 0-100000/1048576");

	const reader = response.body.getReader();
	const chunk = await reader.read();
	assert.ok(!chunk.done);

	abortController.abort();
	await reader.cancel().catch(() => {});

	// Wait for destroy propagation
	await new Promise((resolve) => setTimeout(resolve, 50));

	assert.equal(saveVideoSignal?.aborted, true);
	assert.equal(destroyCalled, true);
	assert.equal(sourceStream.destroyed, true);
});

test("/api/stream/video cleans up when requested byte range is fully served", async (t) => {
	const managerKey = Symbol.for("ziplayer.PlayerManager.instance");
	const originalManager = globalThis[managerKey];
	const hookKeys = ["logger", "server", "streamWss"];
	const originalHooks = new Map(hookKeys.map((key) => [key, useHooks.get(key)]));

	let destroyCalled = false;
	const sourceStream = new Readable({
		read() {
			this.push(Buffer.alloc(512, "x"));
		},
	});
	sourceStream.metadata = {
		mime: "video/mp4",
		contentLength: "1048576",
	};
	sourceStream.destroyStream = () => {
		destroyCalled = true;
	};

	const mockPlayer = {
		saveVideo: async () => sourceStream,
	};
	globalThis[managerKey] = {
		getPlayer: () => mockPlayer,
		create: async () => mockPlayer,
	};

	const app = createWebApp();
	useHooks.set("server", app);
	useHooks.set("streamWss", new EventEmitter());
	useHooks.set("logger", { debug() {}, info() {}, error() {} });

	const streamModule = require("../extensions/routes/stream.js");
	streamModule.execute();

	t.after(() => {
		globalThis[managerKey] = originalManager;
		for (const [key, val] of originalHooks) {
			if (val === undefined) useHooks.delete(key);
			else useHooks.set(key, val);
		}
	});

	const response = await app.request("/api/stream/video?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
		headers: {
			Range: "bytes=0-1023",
		},
	});

	assert.equal(response.status, 206);
	const data = await response.arrayBuffer();
	assert.equal(data.byteLength, 1024);

	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(destroyCalled, true);
	assert.equal(sourceStream.destroyed, true);
});
