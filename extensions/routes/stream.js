const { Hono } = require("hono");
const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { Readable } = require("node:stream");

const Logger = useHooks.get("logger");
const router = new Hono();

function parseTrackData(context) {
	const trackData = context.req.query("trackData");
	if (!trackData) return { response: context.text("Bad Request", 400) };

	try {
		return { trackData: JSON.parse(trackData) };
	} catch {
		return { response: context.json({ error: "Invalid trackData" }, 400) };
	}
}

function streamRoute(method, contentType, logLabel, errorMessage) {
	return async (context) => {
		const parsed = parseTrackData(context);
		if (parsed.response) return parsed.response;

		const controller = new AbortController();
		const requestSignal = context.req.raw.signal;
		const abort = () => controller.abort();
		const cleanup = () => requestSignal.removeEventListener("abort", abort);
		requestSignal.addEventListener("abort", abort, { once: true });

		try {
			const player = await getManager().create("webid");
			const stream = await player[method](parsed.trackData, { signal: controller.signal });
			if (controller.signal.aborted) {
				stream.destroy();
				cleanup();
				return;
			}

			stream.once("end", cleanup);
			stream.once("error", cleanup);
			stream.once("close", () => {
				if (!stream.readableEnded) controller.abort();
				cleanup();
			});
			return context.body(Readable.toWeb(stream), 200, {
				"Content-Type": contentType,
				"Accept-Ranges": "bytes",
				"Cache-Control": "no-cache",
			});
		} catch (error) {
			cleanup();
			if (controller.signal.aborted) return;
			Logger.error(`[Stream] ${logLabel} error:`, error);
			return context.json({ error: errorMessage }, 500);
		}
	};
}

router.get("/audio", streamRoute("save", "audio/webm", "Audio", "Audio stream failed"));
router.get("/video", streamRoute("saveVideo", "application/vnd.yt-ump", "Video", "Video stream failed"));

module.exports.data = {
	name: "streamRoutes",
	description: "Hybrid progressive streaming route",
	version: "2.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = () => {
	useHooks.get("server").route("/api/stream", router);
};
