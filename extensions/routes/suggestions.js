const { Hono } = require("hono");
const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const router = new Hono();

module.exports.data = {
	name: "suggestionsRoutes",
	description: "Suggestions route for fetching related tracks",
	version: "1.0.0",
	enable: true,
	priority: 9,
};

router.post("/", async (context) => {
	const track = context.get("body")?.track || {
		id: "J1X6LEa1hYA",
		title: "Nightcore ~ Chỉ Bằng Cái Gật Đầu [ Remix ] | PN Nightcore",
		url: "https://www.youtube.com/watch?v=J1X6LEa1hYA",
		source: "youtube",
	};

	try {
		const player = await getManager().create("default");
		const result = await player.pluginManager.getRelatedTracks(track);
		return context.json({ results: result, total: result.length });
	} catch (error) {
		console.error("Search error:", error);
		return context.json({ error: "Search failed" }, 500);
	}
});

module.exports.execute = () => {
	useHooks.get("server").route("/api/suggestions", router);
};
