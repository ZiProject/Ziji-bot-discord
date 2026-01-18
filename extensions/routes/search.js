const express = require("express");
const { getManager } = require("ziplayer");

const router = express.Router();

router.get("/", async (req, res) => {
	const { q, source = "all" } = req.query;

	if (!q) {
		return res.status(400).json({ error: "Query parameter required" });
	}

	try {
		const result = await getManager().search(q, source);
		res.json({ results: result.tracks, total: result.tracks.length });
	} catch (error) {
		console.error("Search error:", error);
		res.status(500).json({ error: "Search failed" });
	}
});

module.exports = { router };

module.exports.data = {
	name: "searchRoutes",
	description: "Search route for querying tracks",
	version: "1.0.0",
	disable: true, //for web router
};
module.exports.execute = () => {
	return;
};
