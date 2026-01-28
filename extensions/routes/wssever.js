const { useHooks } = require("zihooks");
const { getManager, Player } = require("ziplayer");

module.exports.data = {
	name: "wssever",
	description: "WebSocket server",
	version: "1.0.0",
	enable: true,
};

module.exports.execute = () => {
	const wss = useHooks.get("wss");
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
					const manager = getManager();
					await manager.create("webid");
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
};
