const search = require("./search");
const stream = require("./stream");
const lyrics = require("./lyrics");
const { WebSocketServer } = require("./wssever");

module.exports = { searchRoutes: search.router, streamRoutes: stream.router, lyricsRoutes: lyrics.router, WebSocketServer };

module.exports.data = {
	name: "routesIndex",
	description: "Index of all route modules",
	version: "1.0.0",
	disable: true, //for web router
};
module.exports.execute = () => {
	return;
};
