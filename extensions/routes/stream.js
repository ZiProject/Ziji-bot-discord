const express = require("express");
const router = express.Router();

const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const Logger = useHooks.get("logger");

const { pipeline } = require("stream/promises");

router.get("/play", async (req, res) => {
	if (!req.query.trackData) return res.sendStatus(400);
	let trackData;
	try {
		trackData = JSON.parse(req.query.trackData);
	} catch {
		return res.sendStatus(400);
	}

	try {
		const player = await getManager().create("webid");
		const stream = await player.save(trackData); // -> Stream.Readable

		res.writeHead(200, {
			"Accept-Ranges": "bytes",
			"Content-Type": "audio/webm",
		});

		await pipeline(stream, res);
	} catch (err) {
		Logger.error("[Stream] Error:", err);
		res.sendStatus(500);
	}
});

module.exports.data = {
	name: "streamRoutes",
	description: "Hybrid progressive streaming route",
	version: "2.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/api/stream", router);
	return;
};
