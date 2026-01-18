const express = require("express");
const { lyricsExt } = require("@ziplayer/extension");

const router = express.Router();

router.get("/", async (req, res) => {
	const lyricsext = new lyricsExt();

	const lyrics = await lyricsext.fetch({
		title: req.query?.query || req.query?.q,
	}); // await LyricsFunc.search({ query: req.query?.query || req.query?.q });
	res.json(lyrics);
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
