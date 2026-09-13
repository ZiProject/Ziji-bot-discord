const express = require("express");
const router = express.Router();

const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");

const Logger = useHooks.get("logger");
const { pipeline } = require("stream/promises");

function parseTrackData(req, res) {
	if (!req.query.trackData) {
		res.sendStatus(400);
		return null;
	}

	try {
		return JSON.parse(req.query.trackData);
	} catch {
		res.status(400).json({
			error: "Invalid trackData",
		});
		return null;
	}
}

router.get("/audio", async (req, res) => {
	const trackData = parseTrackData(req, res);

	if (!trackData) {
		return;
	}

	const controller = new AbortController();

	const abort = () => {
		controller.abort();
	};

	req.once("close", abort);

	try {
		const player = await getManager().create("webid");

		const stream = await player.save(trackData, {
			signal: controller.signal,
		});

		if (controller.signal.aborted) {
			stream.destroy();
			return;
		}

		res.writeHead(200, {
			"Content-Type": "audio/webm",
			"Accept-Ranges": "bytes",
			"Cache-Control": "no-cache",
		});

		await pipeline(stream, res, {
			signal: controller.signal,
		});
	} catch (err) {
		if (controller.signal.aborted) {
			return;
		}

		Logger.error("[Stream] Audio error:", err);

		if (!res.headersSent) {
			res.status(500).json({
				error: "Audio stream failed",
			});
		} else {
			res.destroy(err);
		}
	} finally {
		req.off("close", abort);
	}
});

router.get("/video", async (req, res) => {
	const trackData = parseTrackData(req, res);

	if (!trackData) {
		return;
	}

	const controller = new AbortController();

	const abort = () => {
		controller.abort();
	};

	req.once("close", abort);

	try {
		const player = await getManager().create("webid");

		const stream = await player.saveVideo(trackData, {
			signal: controller.signal,
		});

		if (controller.signal.aborted) {
			stream.destroy();
			return;
		}

		res.writeHead(200, {
			"Content-Type": "application/vnd.yt-ump",
			"Accept-Ranges": "bytes",
			"Cache-Control": "no-cache",
		});

		await pipeline(stream, res, {
			signal: controller.signal,
		});
	} catch (err) {
		if (controller.signal.aborted) {
			return;
		}

		Logger.error("[Stream] Video error:", err);

		if (!res.headersSent) {
			res.status(500).json({
				error: "Video stream failed",
			});
		} else {
			res.destroy(err);
		}
	} finally {
		req.off("close", abort);
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
};
