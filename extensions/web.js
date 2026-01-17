const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { useHooks } = require("@zibot/zihooks");
const { getManager, Player } = require("ziplayer");
const http = require("http");
const { lyricsExt } = require("@ziplayer/extension");

module.exports.execute = async () => {
	if (!useHooks.get("config")?.webAppConfig?.enabled) return;
	useHooks.get("logger")?.debug?.("Starting web...");
	const logger = useHooks.get("logger");
	const client = useHooks.get("client");
	const manager = getManager();
	const player = await manager.create("webid");

	const app = express();

	const server = http.createServer(app);
	app.use(
		cors({
			origin: "*",
			methods: ["GET", "POST"],
			credentials: true,
		}),
	);

	app.use(express.json());

	server.listen(process.env.SERVER_PORT || 2003, () => {
		logger.info(`Server running on port ${process.env.SERVER_PORT || 2003}`);
	});

	app.get("/", (req, res) => {
		if (!client.isReady())
			return res.json({
				status: "NG",
				content: "API loading...!",
			});

		res.json({
			status: "OK",
			content: "Welcome to API!",
			clientName: client?.user?.displayName,
			clientId: client?.user?.id,
			avatars: client?.user?.displayAvatarURL({ size: 1024 }),
		});
	});

	app.get("/api/health", (req, res) => {
		res.json({ status: "ok" });
	});

	app.get("/api/search", async (req, res) => {
		try {
			const query = req.query?.query || req.query?.q;
			if (!query) {
				return res.status(400).json({ error: "Search query is required! Use /api/search?query=<input>" });
			}

			const searchResults = await player.search(query, {
				requestedBy: client.user,
			});

			res.json({ results: searchResults.tracks, total: searchResults.tracks.length });
		} catch (error) {
			logger.error("Search error:", error);
			res.status(500).json({ error: "An error occurred during search" });
		}
	});

	app.get("/api/lyrics", async (req, res) => {
		const lyricsext = new lyricsExt();

		const lyrics = await lyricsext.fetch({
			title: req.query?.query || req.query?.q,
		}); // await LyricsFunc.search({ query: req.query?.query || req.query?.q });
		res.json(lyrics);
	});

	const wss = new WebSocket.Server({ server });

	wss.on("connection", (ws) => {
		logger.debug("[WebSocket] Client connected.");

		let user = null;
		/**
		 * @type {Player}
		 * @description The queue of the user
		 */
		let queue = null;

		ws.on("message", async (message) => {
			try {
				const data = JSON.parse(message);
				logger.debug(data);

				if (data.event == "GetVoice") {
					user = await client.users.fetch(data.userID);

					const userData = manager.getall().find((node) => node?.userdata?.listeners?.includes(user));

					if (userData?.connection) {
						queue = userData;
						ws.send(
							JSON.stringify({ event: "ReplyVoice", channel: userData.userdata.channel, guild: queue.userdata.channel.guild }),
						);
					}
				}
				if (!queue || (queue.userdata.LockStatus && queue.userdata.requestedBy?.id !== (user?.id || data.userID))) return;

				switch (data.event) {
					case "pause":
						if (queue.isPaused) {
							queue.resume();
						} else {
							queue.pause();
						}
						break;
					case "play":
						await queue.play(data.trackUrl);
						break;
					case "skip":
						queue.skip();
						break;
					case "back":
						if (queue.previousTrack) queue.previous();
						break;
					case "volume":
						await queue.setVolume(Number(data.volume));
						break;
					case "loop":
						queue.loop(["off", "track", "queue"](Number(data.mode)));
						break;
					case "shuffle":
						await queue.shuffle();
						break;
					case "Playnext":
						if (queue.queue.isEmpty || !data.trackUrl || !data.TrackPosition) break;
						const res = await player.search(data.trackUrl, user);
						if (res) {
							await queue.remove(data.TrackPosition - 1);
							await queue.insert(res.tracks?.at(0), 0);
							await queue.skip();
						}
						break;
					case "DelTrack":
						if (queue.queue.isEmpty || !data.TrackPosition) break;
						queue.remove(data.TrackPosition - 1);
						break;
					case "seek":
						// if (!queue.isPlaying() || !data.position) break;
						// await queue.node.seek(data.position);
						break;
				}
			} catch (error) {
				logger.error("WebSocket message error:", error);
			}
		});

		const sendStatistics = async () => {
			if (!queue?.connection) return;
			try {
				const queueTracks = queue.queue.tracks.map((track) => ({
					title: track.title,
					url: track.url,
					duration: track.duration,
					thumbnail: track.thumbnail,
					author: track?.metadata?.author,
				}));

				const currentTrack =
					queue.currentTrack ?
						{
							title: queue.currentTrack.title,
							url: queue.currentTrack.url,
							duration: queue.currentTrack.duration,
							thumbnail: queue.currentTrack.thumbnail,
							author: queue.currentTrack?.metadata?.author,
						}
					:	null;

				ws.send(
					JSON.stringify({
						event: "statistics",
						timestamp: queue.getTime(),
						listeners: queue.userdata?.channel?.members.filter((mem) => !mem.user.bot).size ?? 0,
						tracks: queue.queue.tracks?.length,
						volume: queue.volume,
						paused: queue.isPaused,
						repeatMode: queue.loop(),
						track: currentTrack,
						queue: queueTracks,
						filters: null,
						shuffle: null,
					}),
				);
			} catch (error) {
				logger.error("Error in statistics handler:", error);
			}
		};

		const statsInterval = setInterval(sendStatistics, 1000);
		sendStatistics();

		ws.on("close", () => {
			logger.debug("[WebSocket] Client disconnected.");
			clearInterval(statsInterval);
		});
	});

	app.post("/api/stream/play", async (req, res) => {
		const { track } = req.body;

		if (!track) {
			return res.status(400).json({ error: "Track required" });
		}

		try {
			const streamInfo = await player.save(track); //return ReadableStream

			if (!streamInfo) {
				return res.status(404).json({ error: "Stream not available" });
			}

			res.setHeader("Content-Type", "audio/webm");
			streamInfo.pipe(res);
		} catch (error) {
			console.error("Stream error:", error);
			res.status(500).json({ error: "Stream failed" });
		}
	});
};

module.exports.data = {
	name: "web",
	type: "extension",
	enable: true,
};
