const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");
const jwt = require("jsonwebtoken");

async function getPlayerVoiceChannel(user, client) {
	let voiceChannel = null;
	const voiceStates = useHooks.get("voiceStates");

	if (voiceStates?.has(user.id)) voiceChannel = voiceStates.get(user.id)?.channel;

	if (!voiceChannel) {
		for (const guild of client.guilds.cache.values()) {
			try {
				const member = await guild.members.fetch(user.id);

				if (member?.voice?.channel) {
					voiceChannel = member.voice.channel;

					if (voiceStates) {
						voiceStates.set(user.id, {
							channelId: member.voice.channel.id,
							guildId: guild.id,
							channel: member.voice.channel,
						});
					}

					break;
				}
			} catch {
				continue;
			}
		}
	}

	return getPlayer(`${voiceChannel.guild.id}::${voiceChannel.id}`);
}

module.exports.data = {
	name: "wssever",
	description: "WebSocket server with Auth",
	version: "1.2.0",
	enable: true,
	priority: 9,
};

module.exports.execute = (client) => {
	const wss = useHooks.get("wss");
	const logger = useHooks.get("logger");

	if (!wss) {
		logger.error("[WebSocket] WSS instance not found.");
		return;
	}

	logger.info("[WebSocket] Server initialized.");

	wss.on("connection", (ws, req) => {
		const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

		logger.debug(`[WebSocket] Client connected: ${ip}`);

		let user = null;
		let player = null;
		let authenticated = false;
		let statsInterval = null;

		// Heartbeat
		ws.isAlive = true;

		ws.on("pong", () => {
			ws.isAlive = true;
		});

		const safeSend = (payload) => {
			try {
				if (ws.readyState === ws.OPEN) {
					ws.send(JSON.stringify(payload));
				}
			} catch (err) {
				logger.error("[WebSocket] Send error:", err);
			}
		};

		const sendStatistics = async () => {
			try {
				if (!authenticated) return;
				if (!player?.connection) return;

				const queueTracks =
					player.queue?.tracks?.map((track) => ({
						title: track.title,
						url: track.url,
						duration: track.duration,
						thumbnail: track.thumbnail,
						author: track?.metadata?.author,
					})) || [];

				const currentTrack =
					player.currentTrack ?
						{
							title: player.currentTrack.title,
							url: player.currentTrack.url,
							duration: player.currentTrack.duration,
							thumbnail: player.currentTrack.thumbnail,
							author: player.currentTrack?.metadata?.author,
						}
					:	null;

				safeSend({
					event: "statistics",
					timestamp: player.getTime()?.current ?? player.currentResource?.playbackDuration,
					listeners: player.userdata?.channel?.members?.filter((mem) => !mem.user.bot).size ?? 0,
					tracks: queueTracks.length,
					volume: player.volume,
					paused: player.isPaused,
					repeatMode: player.loop(),
					autoPlay: player.autoPlay(),
					lockStatus: player.userdata?.LockStatus,
					track: currentTrack,
					queue: queueTracks,
					related:
						player.relatedTracks?.map((t) => ({
							title: t.title,
							url: t.url,
							duration: t.duration,
							thumbnail: t.thumbnail,
							author: t?.metadata?.author,
						})) || [],
					filters: null,
					shuffle: null,
				});
			} catch (error) {
				logger.error("[Statistics] Error:", error);
			}
		};

		ws.on("message", async (message) => {
			try {
				const raw = message.toString();

				logger.debug(`[WebSocket] Raw message: ${raw}`);

				let data;

				try {
					data = JSON.parse(raw);
				} catch (err) {
					logger.warn("[WebSocket] Invalid JSON.");
					return safeSend({
						event: "error",
						message: "Invalid JSON",
					});
				}

				logger.debug(`[WebSocket] Event: ${data.event}`);

				// AUTH
				if (data.event === "identify") {
					try {
						if (!process.env.JWT_SECRET) {
							logger.error("[Auth] JWT_SECRET missing.");
							return safeSend({
								event: "error",
								message: "Server auth misconfigured",
							});
						}

						const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

						logger.debug(`[Auth] Token verified for user ${decoded.id}`);

						user = await client.users.fetch(decoded.id);

						if (!user) {
							logger.warn(`[Auth] User fetch failed: ${decoded.id}`);

							return safeSend({
								event: "error",
								message: "User not found",
							});
						}

						authenticated = true;

						logger.info(`[Auth] Authenticated: ${user.username} (${user.id})`);

						safeSend({
							event: "authenticated",
							user: {
								id: user.id,
								username: user.username,
							},
						});
						player = await getPlayerVoiceChannel(user, client);
						if (player?.connection) {
							logger.debug(`[Player] Found active player for ${user.username}`);

							safeSend({
								event: "ReplyVoice",
								channel: {
									id: player.userdata.channel.id,
									name: player.userdata.channel.name,
								},
								guild: {
									id: player.userdata.channel.guild.id,
									name: player.userdata.channel.guild.name,
								},
							});

							if (!statsInterval) {
								statsInterval = setInterval(sendStatistics, 1000);

								logger.debug("[Statistics] Interval started.");
							}
						} else {
							logger.debug(`[Player] No active player for ${user.username}`);
						}
					} catch (err) {
						logger.warn("[Auth] Invalid token:", err.message);

						safeSend({
							event: "error",
							message: "Invalid token",
						});
					}

					return;
				}

				// BLOCK UNAUTH
				if (!authenticated) {
					logger.warn("[WebSocket] Unauthorized request.");

					return safeSend({
						event: "error",
						message: "Not authenticated",
					});
				}

				// GET VOICE
				if (data.event === "GetVoice") {
					logger.debug(`[Voice] Fetching player for ${user.username}`);

					player = await getPlayerVoiceChannel(user, client);

					if (player?.connection) {
						logger.debug("[Voice] Active voice found.");

						safeSend({
							event: "ReplyVoice",
							channel: {
								id: player.userdata.channel.id,
								name: player.userdata.channel.name,
							},
							guild: {
								id: player.userdata.channel.guild.id,
								name: player.userdata.channel.guild.name,
							},
						});

						if (!statsInterval) {
							statsInterval = setInterval(sendStatistics, 1000);

							logger.debug("[Statistics] Interval started.");
						}
					} else {
						logger.warn("[Voice] No active voice connection.");

						safeSend({
							event: "error",
							message: "No active voice connection found for user",
						});
					}

					return;
				}

				if (!player) {
					logger.warn("[Player] Command ignored: player null.");
					return;
				}

				// LOCK CHECK
				if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== user.id) {
					logger.warn(`[Player] Locked by another user. (${user.username})`);

					return;
				}

				logger.debug(`[Player] Executing event "${data.event}"`);

				switch (data.event) {
					case "pause":
						if (player.isPaused) {
							player.resume();
							logger.debug("[Player] Resume");
						} else {
							player.pause();
							logger.debug("[Player] Pause");
						}
						break;

					case "play":
						logger.debug(`[Player] Play request: ${data.trackUrl}`);

						await player.play(data.trackUrl);
						break;

					case "skip":
						logger.debug("[Player] Skip");
						player.skip();
						break;

					case "back":
						logger.debug("[Player] Previous");

						if (player.previousTrack) {
							player.previous();
						}
						break;

					case "volume":
						logger.debug(`[Player] Volume: ${data.volume}`);

						await player.setVolume(Number(data.volume));
						break;

					case "loop":
					case "Loop": {
						const repeatt = ["off", "track", "queue"];

						const currentMode = player.loop();

						const nextIndex = (repeatt.indexOf(currentMode) + 1) % 3;

						player.autoPlay(false);

						player.loop(repeatt[nextIndex]);

						logger.debug(`[Player] Loop mode: ${repeatt[nextIndex]}`);

						break;
					}

					case "shuffle":
					case "Shuffle":
						logger.debug("[Player] Shuffle");

						await player.shuffle();
						break;

					case "seek":
						logger.debug(`[Player] Seek: ${data.position}`);

						await player.seek(data.position);
						break;

					case "Lock":
						player.userdata.LockStatus = !player.userdata.LockStatus;

						logger.debug(`[Player] Lock: ${player.userdata.LockStatus}`);

						break;

					case "AutoPlay":
						player.loop("off");

						player.autoPlay(!player.autoPlay());

						logger.debug(`[Player] AutoPlay: ${player.autoPlay()}`);

						break;

					case "Playnext":
						logger.debug(`[Player] PlayNext: ${data.trackUrl}`);

						if (player.queue.isEmpty || !data.trackUrl || !data.TrackPosition) break;

						const res = await player.search(data.trackUrl, user);

						if (res) {
							await player.remove(data.TrackPosition - 1);

							await player.insert(res.tracks?.at(0), 0);

							await player.skip();
						}

						break;

					case "DelTrack":
						logger.debug(`[Player] Delete track: ${data.TrackPosition}`);

						if (player.queue.isEmpty || !data.TrackPosition) break;

						player.remove(data.TrackPosition - 1);

						break;

					default:
						logger.warn(`[WebSocket] Unknown event: ${data.event}`);
						break;
				}
			} catch (error) {
				logger.error("[WebSocket] Message error:", error);
			}
		});

		ws.on("error", (err) => {
			logger.error("[WebSocket] Socket error:", err);
		});

		ws.on("close", (code, reason) => {
			logger.debug(`[WebSocket] Client disconnected. Code=${code} Reason=${reason}`);

			if (statsInterval) {
				clearInterval(statsInterval);

				logger.debug("[Statistics] Interval cleared.");
			}
		});
	});

	// Heartbeat cleanup
	setInterval(() => {
		wss.clients.forEach((ws) => {
			if (!ws.isAlive) {
				logger.warn("[WebSocket] Terminating dead socket.");
				return ws.terminate();
			}

			ws.isAlive = false;
			ws.ping();
		});
	}, 30000);
};
