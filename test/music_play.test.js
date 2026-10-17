const assert = require("node:assert/strict");
const test = require("node:test");
const { useHooks } = require("zihooks");

const managerKey = Symbol.for("ziplayer.PlayerManager.instance");

test("play command finds the active web stream player in manager players when direct lookup misses", async (t) => {
	const originalManager = globalThis[managerKey];
	const originalFunctions = useHooks.get("functions");
	let playedQuery;
	const streamPlayer = {
		id: "web-stream-user-123",
		connection: null,
		hasOutput: true,
		userdata: {
			webAudioStream: { userId: "user-123" },
		},
		play: async (query) => {
			playedQuery = query;
			return { track: { title: "Test track" } };
		},
	};
	globalThis[managerKey] = {
		get: () => undefined,
		getPlayer: () => undefined,
		getAll: () => [streamPlayer],
	};
	useHooks.set(
		"functions",
		new Map([["playerController", { execute: async () => assert.fail("Expected the web stream player to handle playback") }]]),
	);
	t.after(() => {
		if (originalManager === undefined) delete globalThis[managerKey];
		else globalThis[managerKey] = originalManager;
		useHooks.set("functions", originalFunctions);
	});

	const interaction = {
		user: { id: "user-123" },
		guild: { id: "guild-123" },
		member: { voice: { channel: null } },
		options: {
			getSubcommand: () => "music",
			getString: () => "test query",
		},
		editReply: async () => {},
	};

	await require("../commands/music/music_play.js").execute({ interaction, lang: { music: { NOres: "No result" } } });

	assert.equal(playedQuery, "test query");
});
