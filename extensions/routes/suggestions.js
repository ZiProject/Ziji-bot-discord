const express = require("express");
const { getManager } = require("ziplayer");
const router = express.Router();

router.post("/", async (req, res) => {
	const track = req.body?.track || {
		id: "J1X6LEa1hYA",
		title: "Nightcore ~ Chỉ Bằng Cái Gật Đầu [ Remix ] | PN Nightcore",
		url: "https://www.youtube.com/watch?v=J1X6LEa1hYA",
		source: "youtube",
	};

	try {
		const player = await getManager().create("default");
		const result = await player.getRelatedTracks(track);
		res.json({ results: result, total: result.length });
	} catch (error) {
		console.error("Search error:", error);
		res.status(500).json({ error: "Search failed" });
	}
});

module.exports = { router };

module.exports.data = {
	name: "lyricsRoutes",
	description: "Lyrics route for fetching song lyrics",
	version: "1.0.0",
	disable: true, //for web router
};
module.exports.execute = () => {
	return;
};
