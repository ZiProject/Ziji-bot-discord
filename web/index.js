const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { useClient, useLogger, useConfig, useFunctions } = require("@zibot/zihooks");
const { getManager } = require("ziplayer");
const http = require("http");
const ngrok = require("ngrok");

async function startServer() {
	const logger = useLogger();
	const client = useClient();
	const manager = getManager();
	const player = manager.create("webid");

	const app = express();
	const server = http.createServer(app);
	app.use(
		cors({
			origin: "*",
			methods: ["GET", "POST"],
			credentials: true,
		}),
	);
	server.listen(process.env.SERVER_PORT || 2003, () => {
		logger.info(`Server running on port ${process.env.SERVER_PORT || 2003}`);
	});

	if (process.env.NGROK_AUTHTOKEN && process.env.NGROK_AUTHTOKEN !== "") {
		const url = await ngrok.connect({
			addr: process.env.SERVER_PORT || 2003,
			hostname: process.env.NGROK_DOMAIN,
			authtoken: process.env.NGROK_AUTHTOKEN,
		});
		logger.info(`Server running on ${url}`);
	}

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

	app.get("/api/search", async (req, res) => {
		try {
			const query = req.query?.query || req.query?.q;
			if (!query) {
				return res.status(400).json({ error: "Search query is required! Use /api/search?query=<input>" });
			}

			const searchResults = await player.search(query, {
				requestedBy: client.user,
			});

			res.json(searchResults.tracks.slice(0, 10));
		} catch (error) {
			logger.error("Search error:", error);
			res.status(500).json({ error: "An error occurred during search" });
		}
	});

	app.get("/api/lyrics", async (req, res) => {
		const LyricsFunc = useFunctions().get("Lyrics");
		const lyrics = await LyricsFunc.search({ query: req.query?.query || req.query?.q });
		res.json(lyrics);
	});

	const wss = new WebSocket.Server({ server });

	wss.on("connection", (ws) => {
		logger.debug("[WebSocket] Client connected.");

		let user = null;
		/**
		 * @type {import("discord-player").GuildQueue}
		 * @description The queue of the user
		 */
		let queue = null;

		ws.on("message", async (message) => {
			try {
				const data = JSON.parse(message);
				logger.debug(data);

				if (data.event == "GetVoice") {
					user = await client.users.fetch(data.userID);
					const userQueue = player.queues.cache.find((node) => node.metadata?.listeners.includes(user));
					if (userQueue?.connection) {
						queue = userQueue;
						ws.send(
							JSON.stringify({ event: "ReplyVoice", channel: queue.metadata.channel, guild: queue.metadata.channel.guild }),
						);
					}
				}
				if (!queue || (queue.metadata.LockStatus && queue.metadata.requestedBy?.id !== (user?.id || data.userID))) return;

				switch (data.event) {
					case "pause":
						await queue.node.setPaused(!queue.node.isPaused());
						break;
					case "play":
						await queue.play(data.trackUrl);
						break;
					case "skip":
						await queue.node.skip();
						break;
					case "back":
						if (queue?.history && queue.history?.previousTrack) queue.history.previous();
						break;
					case "volume":
						await queue.node.setVolume(Number(data.volume));
						break;
					case "loop":
						await queue.setRepeatMode(Number(data.mode));
						break;
					case "shuffle":
						await queue.tracks.shuffle();
						break;
					case "filter":
						await queue.filters.ffmpeg.toggle(data.filter);
						break;
					case "Playnext":
						if (queue.isEmpty() || !data.trackUrl || !data.TrackPosition) break;
						const res = await player.search(data.trackUrl, {
							requestedBy: user,
						});
						if (res) {
							await queue.removeTrack(data.TrackPosition - 1);
							await queue.insertTrack(res.tracks?.at(0), 0);
							await queue.node.skip();
						}
						break;
					case "DelTrack":
						if (queue.isEmpty() || !data.TrackPosition) break;
						queue.removeTrack(data.TrackPosition - 1);
						break;
					case "seek":
						if (!queue.isPlaying() || !data.position) break;
						await queue.node.seek(data.position);
						break;
				}
			} catch (error) {
				logger.error("WebSocket message error:", error);
			}
		});

		const sendStatistics = async () => {
			if (!queue?.connection) return;
			try {
				const queueTracks = queue.tracks.map((track) => ({
					title: track.title,
					url: track.url,
					duration: track.duration,
					thumbnail: track.thumbnail,
					author: track.author,
				}));

				const currentTrack =
					queue.currentTrack ?
						{
							title: queue.currentTrack.title,
							url: queue.currentTrack.url,
							duration: queue.currentTrack.duration,
							thumbnail: queue.currentTrack.thumbnail,
							author: queue.currentTrack.author,
						}
					:	null;

				ws.send(
					JSON.stringify({
						event: "statistics",
						timestamp: {
							current: queue.node.getTimestamp()?.current?.value ?? 0,
							total: queue.currentTrack?.durationMS,
						},
						listeners: queue.metadata?.channel?.members.filter((mem) => !mem.user.bot).size ?? 0,
						tracks: queue.tracks.size,
						volume: queue.node.volume,
						paused: queue.node.isPaused(),
						repeatMode: queue.repeatMode,
						track: currentTrack,
						queue: queueTracks,
						filters: queue.filters.ffmpeg.getFiltersEnabled(),
						shuffle: queue.tracks.shuffled,
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
}

module.exports = { startServer };
