const { useHooks } = require("zihooks");
const { getPlayer, getManager } = require("ziplayer");
const jwt = require("jsonwebtoken");

function trackStart(wss, logger) {
	const manager = getManager();
	if (!manager) return;

	manager.on("trackStart", (player, track) => {
		wss.clients.forEach((ws) => {
			if (ws.authenticated && ws.user) {
				// Nếu chưa có player hoặc player khác, kiểm tra xem user có trong channel không
				if (!ws.player || ws.player !== player) {
					const member = player.userdata?.channel?.members?.get(ws.user.id);
					if (member) {
						ws.player = player;
					}
				}

				if (ws.player === player) {
					try {
						ws.send(
							JSON.stringify({
								event: "ReplyVoice",
								channel: {
									id: player.userdata?.channel?.id,
									name: player.userdata?.channel?.name,
								},
								guild: {
									id: player.userdata?.channel?.guild?.id,
									name: player.userdata?.channel?.guild?.name,
								},
							}),
						);
						// Kích hoạt gửi stats nếu chưa có
						ws.sendStatistics();
						ws.startStats();
					} catch (e) {
						logger.error(`[WebSocket] trackStart broadcast error: ${e.message}`);
					}
				}
			}
		});
	});
}

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

	trackStart(wss, logger);

	logger.info("[WebSocket] Server initialized.");

	wss.on("connection", (ws, req) => {
		const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

		logger.debug(`[WebSocket] Client connected: ${ip}`);

		ws.authenticated = false;
		ws.player = null;
		ws.user = null;
		ws.statsInterval = null;

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
				if (!ws.authenticated) return;
				if (!ws.player?.connection) return;

				const queueTracks =
					ws.player.queue?.tracks?.map((track) => ({
						title: track.title,
						url: track.url,
						duration: track.duration,
						thumbnail: track.thumbnail,
						author: track?.metadata?.author,
					})) || [];

				const currentTrack =
					ws.player.currentTrack ?
						{
							title: ws.player.currentTrack.title,
							url: ws.player.currentTrack.url,
							duration: ws.player.currentTrack.duration,
							thumbnail: ws.player.currentTrack.thumbnail,
							author: ws.player.currentTrack?.metadata?.author,
						}
					:	null;

				safeSend({
					event: "statistics",
					timestamp: ws.player.getTime()?.current ?? ws.player.currentResource?.playbackDuration,
					listeners: ws.player.userdata?.channel?.members?.filter((mem) => !mem.user.bot).size ?? 0,
					tracks: queueTracks.length,
					volume: ws.player.volume,
					paused: ws.player.isPaused,
					repeatMode: ws.player.loop(),
					autoPlay: ws.player.autoPlay(),
					lockStatus: ws.player.userdata?.LockStatus,
					track: currentTrack,
					queue: queueTracks,
					related:
						ws.player.relatedTracks?.map((t) => ({
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

		ws.sendStatistics = sendStatistics;
		ws.startStats = () => {
			if (!ws.statsInterval && ws.authenticated && ws.player) {
				ws.statsInterval = setInterval(sendStatistics, 1000);
				logger.debug(`[Statistics] Interval started for ${ws.user?.username}`);
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

						ws.user = await client.users.fetch(decoded.id);

						if (!ws.user) {
							logger.warn(`[Auth] User fetch failed: ${decoded.id}`);

							return safeSend({
								event: "error",
								message: "User not found",
							});
						}

						ws.authenticated = true;

						logger.info(`[Auth] Authenticated: ${ws.user.username} (${ws.user.id})`);

						safeSend({
							event: "authenticated",
							user: {
								id: ws.user.id,
								username: ws.user.username,
							},
						});
						ws.player = await getPlayerVoiceChannel(ws.user, client);
						if (ws.player?.connection) {
							logger.debug(`[Player] Found active player for ${ws.user.username}`);

							safeSend({
								event: "ReplyVoice",
								channel: {
									id: ws.player.userdata.channel.id,
									name: ws.player.userdata.channel.name,
								},
								guild: {
									id: ws.player.userdata.channel.guild.id,
									name: ws.player.userdata.channel.guild.name,
								},
							});

							ws.startStats();
						} else {
							logger.debug(`[Player] No active player for ${ws.user.username}`);
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
				if (!ws.authenticated) {
					logger.warn("[WebSocket] Unauthorized request.");

					return safeSend({
						event: "error",
						message: "Not authenticated",
					});
				}

				// GET VOICE
				if (data.event === "GetVoice") {
					logger.debug(`[Voice] Fetching player for ${ws.user.username}`);

					ws.player = await getPlayerVoiceChannel(ws.user, client);

					if (ws.player?.connection) {
						logger.debug("[Voice] Active voice found.");

						safeSend({
							event: "ReplyVoice",
							channel: {
								id: ws.player.userdata.channel.id,
								name: ws.player.userdata.channel.name,
							},
							guild: {
								id: ws.player.userdata.channel.guild.id,
								name: ws.player.userdata.channel.guild.name,
							},
						});

						ws.startStats();
					} else {
						logger.warn("[Voice] No active voice connection.");

						safeSend({
							event: "error",
							message: "No active voice connection found for user",
						});
					}

					return;
				}

				if (!ws.player) {
					logger.warn("[Player] Command ignored: player null.");
					return;
				}

				// LOCK CHECK
				if (ws.player.userdata.LockStatus && ws.player.userdata.requestedBy?.id !== ws.user.id) {
					logger.warn(`[Player] Locked by another user. (${ws.user.username})`);

					return;
				}

				logger.debug(`[Player] Executing event "${data.event}"`);

				switch (data.event) {
					case "pause":
						if (ws.player.isPaused) {
							ws.player.resume();
							logger.debug("[Player] Resume");
						} else {
							ws.player.pause();
							logger.debug("[Player] Pause");
						}
						break;

					case "play":
						logger.debug(`[Player] Play request: ${data.trackUrl}`);

						await ws.player.play(data.trackUrl);
						break;

					case "skip":
						logger.debug("[Player] Skip");
						ws.player.skip();
						break;

					case "back":
						logger.debug("[Player] Previous");

						if (ws.player.previousTrack) {
							ws.player.previous();
						}
						break;

					case "volume":
						logger.debug(`[Player] Volume: ${data.volume}`);

						await ws.player.setVolume(Number(data.volume));
						break;

					case "loop":
					case "Loop": {
						const repeatt = ["off", "track", "queue"];

						const currentMode = ws.player.loop();

						const nextIndex = (repeatt.indexOf(currentMode) + 1) % 3;

						ws.player.autoPlay(false);

						ws.player.loop(repeatt[nextIndex]);

						logger.debug(`[Player] Loop mode: ${repeatt[nextIndex]}`);

						break;
					}

					case "shuffle":
					case "Shuffle":
						logger.debug("[Player] Shuffle");

						await ws.player.shuffle();
						break;

					case "seek":
						logger.debug(`[Player] Seek: ${data.position}`);

						await ws.player.seek(data.position);
						break;

					case "Lock":
						ws.player.userdata.LockStatus = !ws.player.userdata.LockStatus;

						logger.debug(`[Player] Lock: ${ws.player.userdata.LockStatus}`);

						break;

					case "AutoPlay":
						ws.player.loop("off");

						ws.player.autoPlay(!ws.player.autoPlay());

						logger.debug(`[Player] AutoPlay: ${ws.player.autoPlay()}`);

						break;

					case "Playnext":
						logger.debug(`[Player] PlayNext: ${data.trackUrl}`);

						if (ws.player.queue.isEmpty || !data.trackUrl || !data.TrackPosition) break;

						const res = await ws.player.search(data.trackUrl, ws.user);

						if (res) {
							await ws.player.remove(data.TrackPosition - 1);

							await ws.player.insert(res.tracks?.at(0), 0);

							await ws.player.skip();
						}

						break;

					case "DelTrack":
						logger.debug(`[Player] Delete track: ${data.TrackPosition}`);

						if (ws.player.queue.isEmpty || !data.TrackPosition) break;

						ws.player.remove(data.TrackPosition - 1);

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

			if (ws.statsInterval) {
				clearInterval(ws.statsInterval);

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
