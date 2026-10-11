const { Hono } = require("hono");
const { getManager, WebSocketAudioOutputBackend } = require("ziplayer");
const { useHooks } = require("zihooks");
const { Readable } = require("node:stream");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const router = new Hono();
const SAMPLE_RATE_HZ = 48_000;
const CHANNELS = 2;
const MAX_LISTENER_BUFFER_BYTES = 256 * 1024;
const STREAM_PLAYER_PREFIX = "web-stream-";
const sessions = new Map();
const idleTimers = new Map();

function logger() {
	return useHooks.get("logger");
}

function getUserId(decoded) {
	return decoded && typeof decoded.id === "string" && /^\d{1,32}$/.test(decoded.id) ? decoded.id : null;
}

function streamSessionId(userId) {
	return `${STREAM_PLAYER_PREFIX}${userId}`;
}

function serializeTrack(track) {
	if (!track) return null;
	return {
		title: track.title ?? "Untitled",
		url: track.url ?? null,
		duration: track.duration ?? 0,
		thumbnail: track.thumbnail ?? null,
		author: track.author ?? track.metadata?.author ?? null,
		source: track.source ?? null,
		isLive: Boolean(track.isLive),
	};
}

function verifyJwt(token) {
	if (!process.env.JWT_SECRET) {
		throw Object.assign(new Error("JWT_SECRET is not configured"), { statusCode: 503 });
	}
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
		if (!getUserId(decoded)) throw new Error("Invalid token subject");
		return decoded;
	} catch (error) {
		if (error.statusCode) throw error;
		throw Object.assign(new Error("Invalid token"), { statusCode: 401 });
	}
}

async function authenticate(context, next) {
	const authorization = context.req.header("authorization");
	const match = authorization?.match(/^Bearer\s+(\S+)$/i);
	if (!match) return context.json({ error: "Bearer token required" }, 401);
	try {
		context.set("streamUser", verifyJwt(match[1]));
	} catch (error) {
		return context.json({ error: error.message }, error.statusCode ?? 401);
	}
	await next();
}

function getSession(sessionId) {
	let session = sessions.get(sessionId);
	if (!session) {
		session = { publisher: null, listeners: new Set(), config: null };
		sessions.set(sessionId, session);
	}
	return session;
}

function sendJson(socket, payload) {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function closeIfSlow(socket, additionalBytes = 0) {
	if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount + additionalBytes > MAX_LISTENER_BUFFER_BYTES) {
		socket.close(1013, "Listener is too slow");
		return true;
	}
	return false;
}

function relay(session, data, isBinary) {
	const byteLength = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
	for (const listener of session.listeners) {
		if (closeIfSlow(listener, byteLength)) continue;
		listener.send(data, { binary: isBinary }, (error) => {
			if (!error) return;
			logger()?.error("[ZiPlayer Stream] Failed to relay audio:", error);
			listener.close(1011, "Audio forwarding failed");
		});
	}
}

function isAudioConfig(message, sessionId) {
	return (
		message?.v === 1 &&
		message.type === "audio:config" &&
		message.sessionId === sessionId &&
		message.protocolVersion === 1 &&
		message.sampleRateHz === SAMPLE_RATE_HZ &&
		message.channels === CHANNELS &&
		message.sampleFormat === "s16" &&
		message.endianness === "little" &&
		message.channelLayout === "interleaved"
	);
}

function isAudioFrame(data) {
	if (data.length <= 16) return false;
	const pcmBytes = data.length - 16;
	return (
		pcmBytes % (CHANNELS * 2) === 0 &&
		data.readUInt16LE(8) === SAMPLE_RATE_HZ &&
		data.readUInt16LE(10) === CHANNELS &&
		data.readUInt16LE(12) === 2
	);
}

function clearIdleTimer(sessionId) {
	const timer = idleTimers.get(sessionId);
	if (timer) clearTimeout(timer);
	idleTimers.delete(sessionId);
}

function scheduleIdleCleanup(sessionId) {
	clearIdleTimer(sessionId);
	const session = sessions.get(sessionId);
	if (session?.listeners.size || !getManager()?.getPlayer(sessionId)) return;

	const timer = setTimeout(() => {
		idleTimers.delete(sessionId);
		if (sessions.get(sessionId)?.listeners.size) return;
		const manager = getManager();
		if (!manager?.getPlayer(sessionId)) return;
		void manager.destroy(sessionId).catch((error) => {
			logger()?.error(`[ZiPlayer Stream] Failed to destroy idle player ${sessionId}:`, error);
		});
	}, 100_000);
	timer.unref?.();
	idleTimers.set(sessionId, timer);
}

function createPublisherSocketFactory(userId, httpServer) {
	return ({ sessionId, signal }) =>
		new Promise((resolve, reject) => {
			if (signal?.aborted) {
				const error = new Error("WebSocket connection was aborted");
				error.name = "AbortError";
				reject(error);
				return;
			}
			const address = httpServer.address();
			if (!address || typeof address === "string") {
				reject(new Error("The stream HTTP server is not listening"));
				return;
			}

			const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/stream`);
			const token = jwt.sign({ id: userId, role: "publisher", sessionId }, process.env.JWT_SECRET, {
				algorithm: "HS256",
				expiresIn: "1m",
			});
			const cleanup = () => {
				socket.off("open", onOpen);
				socket.off("error", onError);
				signal?.removeEventListener("abort", onAbort);
			};
			const onOpen = () => {
				cleanup();
				socket.on("error", (error) => {
					logger()?.error(`[ZiPlayer Stream] Publisher socket error (${sessionId}):`, error);
				});
				socket.send(JSON.stringify({ type: "auth", token }));
				resolve(socket);
			};
			const onError = (error) => {
				cleanup();
				socket.terminate();
				reject(error);
			};
			const onAbort = () => {
				cleanup();
				socket.terminate();
				const error = new Error("WebSocket connection was aborted");
				error.name = "AbortError";
				reject(error);
			};
			socket.once("open", onOpen);
			socket.once("error", onError);
			signal?.addEventListener("abort", onAbort, { once: true });
		});
}

async function getOrCreatePlayer(userId) {
	const manager = getManager();
	if (!manager) throw Object.assign(new Error("ZiPlayer is not available"), { statusCode: 503 });

	const playerId = streamSessionId(userId);
	clearIdleTimer(playerId);
	let player = manager.getPlayer(playerId);
	if (player) return player;

	const httpServer = useHooks.get("httpServer");
	if (!httpServer) throw Object.assign(new Error("Stream server is not available"), { statusCode: 503 });
	player = await manager.create(playerId, {
		audioOutputBackendFactory: ({ playerId: outputPlayerId }) =>
			new WebSocketAudioOutputBackend({
				sessionId: outputPlayerId,
				socketFactory: createPublisherSocketFactory(userId, httpServer),
			}),
		audioProcessing: {
			enabled: true,
			inputFormat: "encoded",
			outputFormat: "pcm16le",
			sampleRate: SAMPLE_RATE_HZ,
			channels: CHANNELS,
		},
		preload: { enabled: false },
		crossfade: { enabled: false },
		userdata: { webAudioStream: { userId } },
	});
	player.on("streamError", (error, track) => {
		logger()?.error(`[ZiPlayer Stream] Playback output error (${playerId}${track?.title ? `, ${track.title}` : ""}):`, error);
	});
	player.on("playerError", (error, track) => {
		logger()?.error(`[ZiPlayer Stream] Playback error (${playerId}${track?.title ? `, ${track.title}` : ""}):`, error);
	});
	return player;
}

function setupStreamWebSocketServer(webSocketServer) {
	if (!webSocketServer || webSocketServer.__ziplayerStreamReady) return;
	webSocketServer.__ziplayerStreamReady = true;
	webSocketServer.on("connection", (socket) => {
		let role = null;
		let sessionId = null;
		const authTimeout = setTimeout(() => socket.close(1008, "Authentication required"), 5000);
		authTimeout.unref?.();

		socket.on("message", (data, isBinary) => {
			if (!role) {
				if (isBinary) {
					socket.close(1003, "Authentication must be JSON");
					return;
				}
				let message;
				try {
					message = JSON.parse(data.toString());
				} catch {
					socket.close(1003, "Invalid JSON");
					return;
				}
				if (message?.type !== "auth" || typeof message.token !== "string") {
					socket.close(1008, "Authentication required");
					return;
				}

				try {
					const decoded = verifyJwt(message.token);
					const userId = getUserId(decoded);
					sessionId = streamSessionId(userId);
					if (decoded.role === "publisher") {
						if (decoded.sessionId !== sessionId) {
							socket.close(1008, "Invalid publisher session");
							return;
						}
						role = "publisher";
						const session = getSession(sessionId);
						if (session.publisher && session.publisher !== socket) {
							session.publisher.close(1012, "Publisher replaced");
						}
						session.publisher = socket;
						scheduleIdleCleanup(sessionId);
						sendJson(socket, { type: "stream:publisher:ready", sessionId });
					} else {
						role = "listener";
						const session = getSession(sessionId);
						clearIdleTimer(sessionId);
						session.listeners.add(socket);
						if (session.config) sendJson(socket, session.config);
					}
					clearTimeout(authTimeout);
				} catch (error) {
					logger()?.warn("[ZiPlayer Stream] WebSocket authentication failed:", error.message);
					socket.close(1008, "Invalid token");
				}
				return;
			}

			if (role !== "publisher") {
				socket.close(1008, "Listeners cannot send messages");
				return;
			}

			const session = sessions.get(sessionId);
			if (!session || session.publisher !== socket) {
				socket.close(1008, "Publisher session expired");
				return;
			}
			if (isBinary) {
				if (!session.config || !isAudioFrame(data)) {
					socket.close(1003, "Invalid or unexpected PCM audio frame");
					return;
				}
				relay(session, data, true);
				return;
			}

			let message;
			try {
				message = JSON.parse(data.toString());
			} catch {
				socket.close(1003, "Invalid JSON control message");
				return;
			}
			if (!isAudioConfig(message, sessionId)) {
				socket.close(1008, "Invalid audio configuration");
				return;
			}
			session.config = message;
			relay(session, JSON.stringify(message), false);
		});

		socket.on("close", () => {
			clearTimeout(authTimeout);
			if (!role || !sessionId) return;
			const session = sessions.get(sessionId);
			if (!session) return;
			if (role === "publisher" && session.publisher === socket) {
				const publishedAudio = session.config !== null;
				session.publisher = null;
				session.config = null;
				if (publishedAudio) {
					for (const listener of session.listeners) {
						sendJson(listener, { v: 1, type: "playback:stop", sessionId });
					}
				}
			} else if (role === "listener") {
				session.listeners.delete(socket);
				scheduleIdleCleanup(sessionId);
			}
			if (!session.publisher && session.listeners.size === 0) sessions.delete(sessionId);
		});
		socket.on("error", (error) => logger()?.error("[ZiPlayer Stream] WebSocket error:", error));
	});
}

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
			logger()?.error(`[Stream] ${logLabel} error:`, error);
			return context.json({ error: errorMessage }, 500);
		}
	};
}

router.get("/audio", streamRoute("save", "audio/webm", "Audio", "Audio stream failed"));
router.get("/video", streamRoute("saveVideo", "application/vnd.yt-ump", "Video", "Video stream failed"));

router.post("/play", authenticate, async (context) => {
	const body = context.get("body");
	if (typeof body?.query !== "string" || !body.query.trim() || body.query.length > 500) {
		return context.json({ error: "query must be a non-empty string of at most 500 characters" }, 400);
	}
	try {
		const user = context.get("streamUser");
		const player = await getOrCreatePlayer(getUserId(user));
		const result = await player.play(body.query.trim(), { requestedBy: getUserId(user) });
		if (!result) return context.json({ error: "No playable track found for this query" }, 422);
		return context.json({
			sessionId: streamSessionId(getUserId(user)),
			track: { title: result.track?.title ?? body.query.trim(), url: result.track?.url ?? null },
		});
	} catch (error) {
		logger()?.error("[ZiPlayer Stream] Playback request failed:", error);
		return context.json({ error: error.message || "Playback request failed" }, error.statusCode ?? 500);
	}
});

router.get("/state", authenticate, async (context) => {
	const userId = getUserId(context.get("streamUser"));
	const player = getManager()?.getPlayer(streamSessionId(userId));
	if (!player) return context.json({ error: "No stream player exists" }, 404);
	return context.json({
		sessionId: streamSessionId(userId),
		currentTrack: serializeTrack(player.currentTrack),
		queue: (player.upcomingTracks ?? []).map(serializeTrack),
		timestamp: player.getTime().current,
		volume: player.volume,
		paused: player.isPaused,
		loopMode: player.loop(),
		autoPlay: player.autoPlay(),
	});
});

router.post("/control", authenticate, async (context) => {
	const body = context.get("body");
	const userId = getUserId(context.get("streamUser"));
	const player = getManager()?.getPlayer(streamSessionId(userId));
	if (!player) return context.json({ error: "No stream player exists" }, 404);
	if (typeof body?.action !== "string") return context.json({ error: "action is required" }, 400);

	try {
		let result;
		switch (body.action) {
			case "pause":
				result = await player.pause();
				break;
			case "resume":
				result = await player.resume();
				break;
			case "stop":
				result = await player.stop();
				break;
			case "skip":
				result = await player.skip();
				break;
			case "seek":
				if (!Number.isFinite(body.positionMs) || body.positionMs < 0) {
					return context.json({ error: "positionMs must be a non-negative number" }, 400);
				}
				result = await player.seek(body.positionMs);
				break;
			case "volume":
				if (!Number.isFinite(body.volume) || body.volume < 0 || body.volume > 200) {
					return context.json({ error: "volume must be a number from 0 to 200" }, 400);
				}
				result = await player.setVolume(body.volume);
				break;
			case "loop":
				if (!["off", "track", "queue"].includes(body.mode)) {
					return context.json({ error: "mode must be off, track, or queue" }, 400);
				}
				result = await player.loop(body.mode);
				break;
			case "autoplay":
				if (typeof body.enabled !== "boolean") {
					return context.json({ error: "enabled must be a boolean" }, 400);
				}
				result = await player.autoPlay(body.enabled);
				break;
			default:
				return context.json({ error: "Unsupported playback control action" }, 400);
		}
		if (result === false) return context.json({ error: `${body.action} was not applied` }, 409);
		return context.json({ sessionId: streamSessionId(userId), action: body.action, result: result ?? null });
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Control "${body.action}" failed:`, error);
		return context.json({ error: error.message || "Playback control failed" }, error.statusCode ?? 500);
	}
});

module.exports.data = {
	name: "streamRoutes",
	description: "JWT-authenticated ZiPlayer PCM WebSocket stream",
	version: "3.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = () => {
	const webSocketServer = useHooks.get("streamWss");
	setupStreamWebSocketServer(webSocketServer);
	useHooks.get("server").route("/api/stream", router);
};
