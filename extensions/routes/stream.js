const { Hono } = require("hono");
const { streamSSE } = require("hono/streaming");
const { getManager, WebAudioConnection } = require("ziplayer");
const { useHooks } = require("zihooks");
const { Readable } = require("node:stream");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const router = new Hono();
const MAX_LISTENER_BUFFER_BYTES = 256 * 1024;
const STREAM_PLAYER_PREFIX = "web-stream-";
const sessions = new Map();
const idleTimers = new Map();
const publisherConnections = new Map();
const publisherConnectionTasks = new Map();
const selectedPlayers = new Map();

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
		message.codec === "opus" &&
		message.sampleRateHz === 48_000 &&
		message.channels === 2
	);
}

function isAudioFrame(data) {
	return Buffer.isBuffer(data) && data.length > 16 && data[0] === 0x5a && data[1] === 0x49 && data[2] === 1 && data[3] === 1;
}

function clearIdleTimer(sessionId) {
	const timer = idleTimers.get(sessionId);
	if (timer) clearTimeout(timer);
	idleTimers.delete(sessionId);
}

function scheduleIdleCleanup(sessionId) {
	clearIdleTimer(sessionId);
	const session = sessions.get(sessionId);
	const manager = getManager();
	const player = manager?.getPlayer(sessionId);
	const publisher = publisherConnections.get(sessionId);
	if (session?.listeners.size || (!publisher && (!player || player.connection))) return;

	const timer = setTimeout(() => {
		idleTimers.delete(sessionId);
		if (sessions.get(sessionId)?.listeners.size) return;
		const currentManager = getManager();
		const currentPublisher = publisherConnections.get(sessionId);
		void (async () => {
			if (currentPublisher) {
				await currentPublisher.registration.disconnect();
				currentPublisher.connection.destroy();
				if (currentPublisher.socket.readyState === WebSocket.OPEN) {
					currentPublisher.socket.close(1000, "No stream listeners");
				}
				if (publisherConnections.get(sessionId) === currentPublisher) publisherConnections.delete(sessionId);
			}
			const idlePlayer = currentManager?.getPlayer(sessionId);
			if (!idlePlayer || idlePlayer.connection) return;
			await currentManager.destroy(sessionId);
		})().catch((error) => {
			logger()?.error(`[ZiPlayer Stream] Failed to clean up idle session ${sessionId}:`, error);
		});
	}, 100_000);
	timer.unref?.();
	idleTimers.set(sessionId, timer);
}

function connectPublisherSocket(userId, sessionId, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			const error = new Error("WebSocket connection was aborted");
			error.name = "AbortError";
			reject(error);
			return;
		}
		const httpServer = useHooks.get("httpServer");
		const address = httpServer?.address();
		if (!address || typeof address === "string") {
			reject(new Error("The stream HTTP server is not listening"));
			return;
		}

		const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/stream`);
		const token = jwt.sign({ id: userId, role: "publisher", sessionId }, process.env.JWT_SECRET, {
			algorithm: "HS256",
			expiresIn: "1m",
		});
		let settled = false;
		const timeout = setTimeout(() => finish(new Error("Publisher authentication timed out")), 5000);
		timeout.unref?.();
		const cleanup = () => {
			clearTimeout(timeout);
			socket.off("open", onOpen);
			socket.off("message", onMessage);
			socket.off("error", onError);
			socket.off("close", onClose);
			signal?.removeEventListener("abort", onAbort);
		};
		const finish = (error, result) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error) {
				socket.terminate();
				reject(error);
			} else {
				socket.on("error", (socketError) => {
					logger()?.error(`[ZiPlayer Stream] Publisher socket error (${sessionId}):`, socketError);
				});
				resolve(result);
			}
		};
		const onOpen = () => {
			socket.send(JSON.stringify({ type: "auth", token }), (error) => {
				if (error) finish(error);
			});
		};
		const onMessage = (data, isBinary) => {
			if (isBinary) {
				finish(new Error("Publisher sent binary data before authentication completed"));
				return;
			}
			let message;
			try {
				message = JSON.parse(data.toString());
			} catch {
				finish(new Error("Publisher sent an invalid authentication response"));
				return;
			}
			if (message?.type !== "stream:publisher:ready" || message.sessionId !== sessionId) {
				finish(new Error("Publisher authentication was rejected"));
				return;
			}
			finish(null, socket);
		};
		const onError = (error) => finish(error);
		const onClose = (code) => finish(new Error(`Publisher socket closed before authentication (${code})`));
		const onAbort = () => {
			const error = new Error("WebSocket connection was aborted");
			error.name = "AbortError";
			finish(error);
		};
		socket.once("open", onOpen);
		socket.on("message", onMessage);
		socket.once("error", onError);
		socket.once("close", onClose);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

async function ensureWebAudioPublisher(player, userId) {
	const sessionId = streamSessionId(userId);
	const existing = publisherConnections.get(sessionId);
	if (existing?.player === player && existing.socket.readyState === WebSocket.OPEN) return existing;

	const pending = publisherConnectionTasks.get(sessionId);
	if (pending) {
		if (pending.player === player) return pending.task;
		await pending.task;
		return ensureWebAudioPublisher(player, userId);
	}

	const task = (async () => {
		if (typeof WebAudioConnection !== "function") {
			throw Object.assign(new Error("The installed ziplayer package does not support direct WebAudioConnection subscriptions"), {
				statusCode: 503,
			});
		}

		const connection =
			existing?.player === player && existing.connection.state.status !== "destroyed" ?
				existing.connection
			:	new WebAudioConnection({ sessionId });
		let socket;
		let registration;
		try {
			socket = await connectPublisherSocket(userId, sessionId);
			connection.attachSocket(socket);
			registration = existing?.player === player ? existing.registration : await player.connect(connection);
			if (existing && existing.player !== player) {
				await existing.registration.disconnect();
				existing.connection.destroy();
			}
			const publisher = { player, connection, registration, socket };
			publisherConnections.set(sessionId, publisher);
			return publisher;
		} catch (error) {
			if (registration && existing?.player !== player) {
				try {
					await registration.disconnect();
				} catch (cleanupError) {
					logger()?.error(`[ZiPlayer Stream] Failed to clean up WebAudio registration (${sessionId}):`, cleanupError);
				}
			}
			if (existing?.player === player) {
				if (socket) {
					connection.detachSocket(socket);
					socket.terminate();
				}
			} else {
				connection.destroy();
				socket?.terminate();
			}
			throw error;
		}
	})();
	const pendingConnection = { player, task };
	publisherConnectionTasks.set(sessionId, pendingConnection);
	try {
		return await task;
	} finally {
		if (publisherConnectionTasks.get(sessionId) === pendingConnection) publisherConnectionTasks.delete(sessionId);
	}
}

async function getUserVoiceState(userId) {
	const voiceStates = useHooks.get("voiceStates");
	const cached = voiceStates?.get(userId);
	if (cached?.channelId && cached?.guildId) return cached;

	const client = useHooks.get("client");
	for (const guild of client?.guilds?.cache?.values?.() ?? []) {
		try {
			const member = await guild.members.fetch(userId);
			if (!member?.voice?.channel) continue;
			const voiceState = {
				channelId: member.voice.channel.id,
				guildId: guild.id,
				channel: member.voice.channel,
			};
			voiceStates?.set(userId, voiceState);
			return voiceState;
		} catch {
			continue;
		}
	}
	return null;
}

function getSelectedPlayer(userId) {
	const manager = getManager();
	const selectedId = selectedPlayers.get(userId);
	const selected = selectedId ? manager?.getPlayer(selectedId) : null;
	if (selected) return selected;
	selectedPlayers.delete(userId);
	return manager?.getPlayer(streamSessionId(userId));
}

function clearVoiceMetadata(player) {
	if (!player.userdata) return;
	delete player.userdata.channel;
	delete player.userdata.voiceChannel;
	delete player.userdata.client;
}

async function getOrCreatePlayer(userId, target = "auto") {
	const manager = getManager();
	if (!manager) throw Object.assign(new Error("ZiPlayer is not available"), { statusCode: 503 });

	const webPlayerId = streamSessionId(userId);
	clearIdleTimer(webPlayerId);
	const webPlayer = manager.getPlayer(webPlayerId);
	const voiceState = target !== "browser" ? await getUserVoiceState(userId) : null;

	if (target !== "browser") {
		if (voiceState?.guildId && voiceState?.channelId) {
			const voicePlayerId = `${voiceState.guildId}::${voiceState.channelId}`;
			const voicePlayer = manager.getPlayer(voicePlayerId);
			if (voicePlayer) {
				if (webPlayer && webPlayer !== voicePlayer && webPlayer.connection) {
					await webPlayer.disconnect();
					clearVoiceMetadata(webPlayer);
				}
				selectedPlayers.set(userId, voicePlayerId);
				clearIdleTimer(voicePlayerId);
				return { player: voicePlayer, target: "discord", playerId: voicePlayerId };
			}
		}
		if (webPlayer?.connection) {
			selectedPlayers.set(userId, webPlayerId);
			return { player: webPlayer, target: "discord", playerId: webPlayerId };
		}
		if (target === "discord") {
			throw Object.assign(new Error("No active Discord player was found in your current voice channel"), {
				statusCode: 409,
			});
		}
	}

	let player = webPlayer;
	if (!player) {
		player = await manager.create(webPlayerId, {
			preload: { enabled: false },
			crossfade: { enabled: false },
			userdata: { webAudioStream: { userId } },
		});
		player.on("streamError", (error, track) => {
			logger()?.error(
				`[ZiPlayer Stream] Playback output error (${webPlayerId}${track?.title ? `, ${track.title}` : ""}):`,
				error,
			);
		});
		player.on("playerError", (error, track) => {
			logger()?.error(`[ZiPlayer Stream] Playback error (${webPlayerId}${track?.title ? `, ${track.title}` : ""}):`, error);
		});
	}
	if (player.connection) {
		await player.disconnect();
		clearVoiceMetadata(player);
	}
	selectedPlayers.set(userId, webPlayerId);
	return { player, target: "browser", playerId: webPlayerId };
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
					socket.close(1003, "Invalid or unexpected Opus audio frame");
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
	if (body.target !== undefined && !["auto", "discord", "browser"].includes(body.target)) {
		return context.json({ error: "target must be auto, discord, or browser" }, 400);
	}
	if (body.positionMs !== undefined && (!Number.isFinite(body.positionMs) || body.positionMs < 0)) {
		return context.json({ error: "positionMs must be a non-negative number" }, 400);
	}
	try {
		const user = context.get("streamUser");
		const userId = getUserId(user);
		const { player, target, playerId } = await getOrCreatePlayer(userId, body.target ?? "auto");
		await ensureWebAudioPublisher(player, userId);
		const result = await player.play(body.query.trim(), { requestedBy: userId });
		if (!result) return context.json({ error: "No playable track found for this query" }, 422);
		if (body.positionMs > 0 && !(await player.seek(body.positionMs))) {
			return context.json({ error: "Track started but the requested position could not be applied" }, 409);
		}
		return context.json({
			sessionId: streamSessionId(userId),
			playerId,
			target,
			track: { title: result.track?.title ?? body.query.trim(), url: result.track?.url ?? null },
		});
	} catch (error) {
		logger()?.error("[ZiPlayer Stream] Playback request failed:", error);
		return context.json({ error: error.message || "Playback request failed" }, error.statusCode ?? 500);
	}
});

router.post("/output", authenticate, async (context) => {
	const body = context.get("body");
	if (!["web", "voice"].includes(body?.mode)) {
		return context.json({ error: "mode must be web or voice" }, 400);
	}
	const userId = getUserId(context.get("streamUser"));
	const sessionId = streamSessionId(userId);
	const manager = getManager();
	const player = getSelectedPlayer(userId);
	if (!player) return context.json({ error: "No browser playback session exists" }, 404);

	try {
		if (body.mode === "web") {
			if (player.connection && selectedPlayers.get(userId) !== sessionId) {
				return context.json(
					{
						error:
							"This is a shared Discord player. Choose Browser-only before starting playback to keep the voice connection unchanged.",
					},
					409,
				);
			}
			if (player.connection) await player.disconnect();
			if (selectedPlayers.get(userId) === sessionId) clearVoiceMetadata(player);
			return context.json({ sessionId, mode: "web" });
		}

		const voiceState = await getUserVoiceState(userId);
		if (!voiceState?.channelId || !voiceState?.guildId) {
			return context.json({ error: "Join a voice channel before switching playback to voice" }, 409);
		}

		const voicePlayerId = `${voiceState.guildId}::${voiceState.channelId}`;
		const voicePlayer = manager?.getPlayer(voicePlayerId);
		if (voicePlayer?.connection && voicePlayer !== player) {
			return context.json(
				{
					error:
						"That voice channel already has a different player. Select the existing Discord player before starting browser playback.",
				},
				409,
			);
		}
		const channelPlayers = manager?.getPlayersInChannel?.(voiceState.channelId) ?? [];
		if (channelPlayers.some((channelPlayer) => channelPlayer !== player && channelPlayer.connection)) {
			return context.json(
				{
					error:
						"That voice channel already has another connected player. Select the existing Discord player to avoid competing connections.",
				},
				409,
			);
		}

		const playerCreate = useHooks.get("functions")?.get("playerCreate");
		if (typeof playerCreate?.getBot !== "function") {
			return context.json({ error: "Voice connection service is unavailable" }, 503);
		}
		const bot = await playerCreate.getBot({ guildId: voiceState.guildId, voiceChannelId: voiceState.channelId });
		if (!bot) return context.json({ error: "No available bot can join your voice channel" }, 409);
		const voiceChannel = await bot.channels.fetch(voiceState.channelId);
		if (!voiceChannel?.isVoiceBased?.()) {
			return context.json({ error: "Your current voice channel is unavailable" }, 409);
		}
		const permissions = voiceChannel.permissionsFor(bot.user);
		if (!permissions?.has("Connect") || !permissions.has("Speak")) {
			return context.json({ error: "The bot needs Connect and Speak permissions in your voice channel" }, 403);
		}

		if (player.connection && player.connection.joinConfig?.channelId !== voiceChannel.id) {
			return context.json({ error: "This player is already connected to a different voice channel" }, 409);
		}
		if (!player.connection) await player.connect(voiceChannel, { group: bot.user.id });
		selectedPlayers.set(userId, player.id ?? (player === voicePlayer ? voicePlayerId : sessionId));
		player.userdata = {
			...player.userdata,
			webAudioStream: { userId },
			channel: player.userdata?.channel ?? voiceChannel,
			voiceChannel,
			client: bot,
		};
		return context.json({
			sessionId,
			mode: "voice",
			channel: { id: voiceChannel.id, name: voiceChannel.name },
		});
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Failed to switch output to ${body.mode}:`, error);
		return context.json({ error: error.message || "Could not switch playback output" }, error.statusCode ?? 500);
	}
});

router.get("/state", authenticate, async (context) => {
	const userId = getUserId(context.get("streamUser"));
	const sessionId = streamSessionId(userId);
	const player = getSelectedPlayer(userId);
	if (!player) return context.json({ error: "No stream player exists" }, 404);

	const getState = () => ({
		sessionId,
		currentTrack: serializeTrack(player.currentTrack),
		queue: (player.queue?.tracks ?? []).map(serializeTrack),
		timestamp: player.getTime?.()?.current,
		volume: player.volume,
		paused: player.isPaused,
		loopMode: player.loop?.(),
		repeatMode: player.loop?.(),
		track:
			player.currentTrack ?
				{
					title: player.currentTrack.title,
					url: player.currentTrack.url,
					duration: player.currentTrack.duration,
					thumbnail: player.currentTrack.thumbnail,
					author: player.currentTrack?.metadata?.author,
				}
			:	null,

		autoPlay: player.autoPlay?.(),
		related:
			(player.relatedTracks ?? []).map((t) => ({
				title: t.title,
				url: t.url,
				duration: t.duration,
				thumbnail: t.thumbnail,
				author: t?.metadata?.author,
			})) || [],
	});

	return streamSSE(context, async (stream) => {
		const unsubscribers = [];
		let closed = false;
		let writeQueue = Promise.resolve();
		let heartbeat;
		let resolveAbort;
		const aborted = new Promise((resolve) => {
			resolveAbort = resolve;
		});

		const enqueue = (write) => {
			writeQueue = writeQueue
				.then(async () => {
					if (!closed && !stream.aborted && !stream.closed) await write();
				})
				.catch((error) => {
					logger()?.error(`[ZiPlayer Stream] Failed to write state for ${sessionId}:`, error);
					stream.abort();
				});
		};
		const publishState = () => enqueue(() => stream.writeSSE({ event: "player-state", data: JSON.stringify(getState()) }));
		const onAbort = () => {
			if (closed) return;
			closed = true;
			clearInterval(heartbeat);
			for (const unsubscribe of unsubscribers) unsubscribe();
			resolveAbort();
		};

		stream.onAbort(onAbort);
		for (const eventName of [
			"TRACK_STARTED",
			"TRACK_END",
			"TRACK_ERROR",
			"playbackStateChanged",
			"queueChanged",
			"queueAdd",
			"queueRemove",
			"queueEnd",
			"playerPause",
			"playerResume",
			"playerStop",
			"volumeRequested",
			"seek",
			"willPlay",
		]) {
			unsubscribers.push(player.subscribe(eventName, publishState));
		}

		await stream.writeSSE({ retry: 3000, event: "player-state", data: JSON.stringify(getState()) });
		if (!closed) {
			heartbeat = setInterval(() => {
				if (player.currentTrack && !player.isPaused) publishState();
				else enqueue(() => stream.write(": keep-alive\n\n"));
			}, 1000);
			heartbeat.unref?.();
		}

		await aborted;
	});
});

router.post("/control", authenticate, async (context) => {
	const body = context.get("body");
	const userId = getUserId(context.get("streamUser"));
	const player = getSelectedPlayer(userId);
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
	description: "JWT-authenticated ZiPlayer Opus WebSocket stream",
	version: "3.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = () => {
	const webSocketServer = useHooks.get("streamWss");
	setupStreamWebSocketServer(webSocketServer);
	useHooks.get("server").route("/api/stream", router);
};
