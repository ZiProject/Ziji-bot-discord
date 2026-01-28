const { lyricsExt } = require("@ziplayer/extension");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "lyricsRoutes",
	description: "Lyrics route for fetching song lyrics",
	version: "1.0.0",
	enable: true,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.get("/api/lyrics", async (req, res) => {
		const lyricsext = new lyricsExt();

		const lyrics = await lyricsext.fetch({
			title: req.query?.query || req.query?.q,
		}); // await LyricsFunc.search({ query: req.query?.query || req.query?.q });
		res.json(lyrics);
	});
	return;
};
