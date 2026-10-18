const { Hono } = require("hono");
const { streamSSE } = require("hono/streaming");
const { getManager, WebAudioConnection } = require("ziplayer");
const { useHooks } = require("zihooks");
const { Readable, Transform } = require("node:stream");
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
		lyrics: track.metadata?.lyrics ?? null,
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
	const userId = sessionId.slice(STREAM_PLAYER_PREFIX.length);
	const player = getBrowserPlayer(userId);
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
			const idlePlayer = getBrowserPlayer(userId);
			if (!idlePlayer || idlePlayer.connection) return;
			await currentManager.destroy(idlePlayer.id);
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
	return getBrowserPlayer(userId) ?? undefined;
}

/**
 * The user's browser-only player: always `web-stream-<userId>`. While the user is on Discord voice the
 * same player object lives under the canonical `<guildId>::<channelId>` id (see `changePlayerId`) and
 * is looked up through the manager by that id instead.
 */
function getBrowserPlayer(userId) {
	return getManager()?.getPlayer(streamSessionId(userId)) ?? null;
}

function clearVoiceMetadata(player) {
	if (!player.userdata) return;
	delete player.userdata.channel;
	delete player.userdata.voiceChannel;
	delete player.userdata.client;
	delete player.userdata.mess;
}

function isWebStreamPlayerId(id) {
	return typeof id === "string" && id.startsWith(STREAM_PLAYER_PREFIX);
}

function safeCurrentTrack(player) {
	try {
		return player?.currentTrack ?? null;
	} catch {
		return null;
	}
}

function describeVoiceChannel(player, voiceState) {
	const voiceChannel = player?.userdata?.voiceChannel ?? voiceState?.channel ?? null;
	return {
		id: player?.connection?.joinConfig?.channelId ?? voiceChannel?.id ?? voiceState?.channelId ?? null,
		name: voiceChannel?.name ?? null,
		guildId: voiceChannel?.guild?.id ?? voiceState?.guildId ?? null,
		guildName: voiceChannel?.guild?.name ?? null,
	};
}

/**
 * Finds the Discord player (`<guildId>::<channelId>`) that the user is listening to.
 * The web must register on this player instead of creating its own `web-stream-*` session,
 * otherwise two players end up competing for the same Discord voice connection.
 */
function findUserDiscordPlayer(userId, voiceState) {
	const manager = getManager();
	if (!manager) return null;

	if (voiceState?.guildId && voiceState?.channelId) {
		const canonicalId = `${voiceState.guildId}::${voiceState.channelId}`;
		const canonical = manager.getPlayer(canonicalId);
		// An unconnected canonical player is the user's browser-only player, not a Discord player.
		if (canonical?.connection) return { player: canonical, playerId: canonicalId };

		const inChannel = (manager.getPlayersInChannel?.(voiceState.channelId) ?? []).find(
			(candidate) => candidate && !isWebStreamPlayerId(candidate.id),
		);
		if (inChannel) return { player: inChannel, playerId: inChannel.id };
		return null;
	}

	// The voice state could not be resolved (cache miss / fetch failure): fall back to the
	// players' own voice channel member lists so we still never open a duplicate session.
	for (const candidate of manager.getAll?.() ?? []) {
		if (!candidate || isWebStreamPlayerId(candidate.id) || !candidate.connection) continue;
		if (candidate.userdata?.voiceChannel?.members?.has?.(userId)) {
			return { player: candidate, playerId: candidate.id };
		}
	}
	return null;
}

/**
 * Removes the browser-only `web-stream-*` player once the user's web session has moved to a
 * Discord player. A browser-only player must never keep (or take) a Discord voice connection.
 */
async function releaseBrowserPlayer(userId, keepPlayer) {
	const manager = getManager();
	const webPlayer = getBrowserPlayer(userId);
	if (!webPlayer || webPlayer === keepPlayer) return;
	const webPlayerId = webPlayer.id;
	try {
		if (webPlayer.connection) await webPlayer.disconnect();
		clearVoiceMetadata(webPlayer);
		await manager.destroy(webPlayerId);
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Failed to release browser player ${webPlayerId}:`, error);
	}
}

/**
 * Removes the user's browser audio output from whichever player it is registered on, so a
 * player never keeps a second (web) output running next to its Discord voice connection
 * once the user has switched to Discord voice.
 */
async function detachWebAudio(userId) {
	const sessionId = streamSessionId(userId);
	clearIdleTimer(sessionId);
	const publisher = publisherConnections.get(sessionId);
	if (!publisher) return false;
	publisherConnections.delete(sessionId);
	try {
		await publisher.registration.disconnect();
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Failed to detach web audio (${sessionId}):`, error);
	}
	publisher.connection.destroy();
	if (publisher.socket.readyState === WebSocket.OPEN) publisher.socket.close(1000, "Output switched to Discord voice");
	return true;
}

/**
 * Moves the user's web session onto the given Discord player and drops any duplicate session.
 * With `{ web: false }` the browser output is removed instead of registered (voice-only output).
 */
async function adoptDiscordPlayer(userId, player, playerId, { web = true } = {}) {
	clearIdleTimer(streamSessionId(userId));
	clearIdleTimer(playerId);
	selectedPlayers.set(userId, playerId);
	let publisher = null;
	if (web) publisher = await ensureWebAudioPublisher(player, userId);
	else await detachWebAudio(userId);
	await releaseBrowserPlayer(userId, player);
	return publisher;
}

function captureBrowserPlayback(userId, exceptPlayer) {
	const webPlayer = getBrowserPlayer(userId);
	if (!webPlayer || webPlayer === exceptPlayer || webPlayer.connection) return null;
	const track = safeCurrentTrack(webPlayer);
	if (!track?.url) return null;
	return { track, positionMs: webPlayer.getTime?.()?.current ?? 0 };
}

async function carryPlaybackOver(userId, player, carried) {
	if (!carried || safeCurrentTrack(player)) return false;
	const result = await player.play(carried.track.url, { requestedBy: userId });
	if (!result) return false;
	if (carried.positionMs > 0) await player.seek(carried.positionMs).catch(() => false);
	return true;
}

/** The connected Discord player that is the user's own renamed browser player, if any. */
function findOwnedDiscordPlayer(userId) {
	const manager = getManager();
	for (const candidate of manager?.getAll?.() ?? []) {
		if (candidate?.connection && candidate.userdata?.webAudioStream?.userId === userId) return candidate;
	}
	return null;
}

/**
 * Renames a player keeping its queue, current track and position (engine `changePlayerId`).
 * Returns false when the engine doesn't support it or the target id is taken.
 */
function renamePlayer(player, newId) {
	const manager = getManager();
	if (!player || player.id === newId) return Boolean(player);
	if (typeof manager?.changePlayerId !== "function" || manager.getPlayer(newId)) return false;
	try {
		manager.changePlayerId(player.id, newId);
		return true;
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Failed to change player id ${player.id} -> ${newId}:`, error);
		return false;
	}
}

async function getOrCreatePlayer(userId, target = "auto") {
	const manager = getManager();
	if (!manager) throw Object.assign(new Error("ZiPlayer is not available"), { statusCode: 503 });

	const webPlayerId = streamSessionId(userId);
	clearIdleTimer(webPlayerId);
	const webPlayer = manager.getPlayer(webPlayerId);

	if (target !== "browser") {
		const voiceState = await getUserVoiceState(userId);
		const found = findUserDiscordPlayer(userId, voiceState);
		if (found) {
			clearIdleTimer(found.playerId);
			return { player: found.player, target: "discord", playerId: found.playerId };
		}
		// Legacy: a browser player that still owns a voice connection.
		if (webPlayer?.connection) return { player: webPlayer, target: "discord", playerId: webPlayerId };
		if (target === "discord") {
			throw Object.assign(new Error("No active Discord player was found in your current voice channel"), {
				statusCode: 409,
			});
		}
	}

	let player = webPlayer;
	if (!player) {
		try {
			player = await manager.create(webPlayerId, {
				preload: { enabled: false },
				crossfade: { enabled: false },
				userdata: { webAudioStream: { userId } },
			});
		} catch (error) {
			// The engine keeps the original routing id of a renamed player reserved.
			const renamed = findOwnedDiscordPlayer(userId);
			if (renamed) {
				throw Object.assign(
					new Error(
						"Your browser player is currently the Discord player. Switch back to Browser audio before using a browser-only player.",
					),
					{ statusCode: 409 },
				);
			}
			throw error;
		}
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

const proxyCorsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Allow-Headers": "*",
	"Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

function parseTrackData(context) {
	const rawTrackData = context.req.query("trackData");
	if (rawTrackData !== undefined) {
		try {
			return { trackData: JSON.parse(rawTrackData) };
		} catch {
			return { response: context.json({ error: "Invalid trackData" }, 400, proxyCorsHeaders) };
		}
	}

	const url = context.req.query("url") || context.req.query("id");
	const title = context.req.query("title") || url;
	if (url || title) {
		return {
			trackData: {
				url:
					url && (url.startsWith("http://") || url.startsWith("https://")) ? url
					: url ? `https://www.youtube.com/watch?v=${url}`
					: null,
				id: context.req.query("id") || undefined,
				title: title || url,
				author: context.req.query("author") || null,
			},
		};
	}

	const authHeader = context.req.header("authorization");
	const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1] || context.req.query("token");
	let userId = context.req.query("userId");
	if (!userId && token) {
		try {
			const decoded = verifyJwt(token);
			userId = getUserId(decoded);
		} catch {}
	}
	if (userId) {
		const player = getSelectedPlayer(userId);
		if (player?.currentTrack) {
			return { trackData: player.currentTrack };
		}
	}

	return { response: context.text("Bad Request", 400, proxyCorsHeaders) };
}

function parseRange(rangeHeader, totalLength) {
	if (!rangeHeader || typeof rangeHeader !== "string") return null;
	const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/);
	if (!match) return null;

	const rawStart = match[1];
	const rawEnd = match[2];

	if (!rawStart && !rawEnd) return null;

	let start;
	let end;

	if (!rawStart) {
		if (!totalLength) return null;
		const suffix = parseInt(rawEnd, 10);
		if (isNaN(suffix) || suffix <= 0) return null;
		start = Math.max(0, totalLength - suffix);
		end = totalLength - 1;
	} else {
		start = parseInt(rawStart, 10);
		if (isNaN(start) || start < 0) return null;
		if (rawEnd) {
			end = parseInt(rawEnd, 10);
			if (isNaN(end) || end < start) return null;
			if (totalLength && end >= totalLength) {
				end = totalLength - 1;
			}
		} else {
			end = totalLength ? totalLength - 1 : undefined;
		}
	}

	if (totalLength && start >= totalLength) {
		return { unsatisfiable: true, total: totalLength };
	}

	return { start, end, total: totalLength };
}

function createRangeStream(sourceStream, start, end) {
	let bytesSkipped = 0;
	let bytesSent = 0;
	const maxBytes = end !== undefined ? end - start + 1 : Infinity;

	const rangeFilter = new Transform({
		transform(chunk, encoding, callback) {
			if (bytesSent >= maxBytes) {
				sourceStream.destroy();
				this.push(null);
				return callback();
			}

			if (bytesSkipped < start) {
				const needToSkip = start - bytesSkipped;
				if (chunk.length <= needToSkip) {
					bytesSkipped += chunk.length;
					return callback();
				}
				chunk = chunk.subarray(needToSkip);
				bytesSkipped = start;
			}

			const remainingAllowed = maxBytes - bytesSent;
			if (chunk.length > remainingAllowed) {
				chunk = chunk.subarray(0, remainingAllowed);
			}

			bytesSent += chunk.length;
			this.push(chunk);

			if (bytesSent >= maxBytes) {
				sourceStream.destroy();
				this.push(null);
			}
			callback();
		},
	});

	sourceStream.on("error", (err) => rangeFilter.destroy(err));
	return sourceStream.pipe(rangeFilter);
}

function streamRoute(method, defaultContentType, logLabel, errorMessage) {
	return async (context) => {
		const parsed = parseTrackData(context);
		if (parsed.response) return parsed.response;

		const controller = new AbortController();
		const requestSignal = context.req.raw.signal;
		const abort = () => controller.abort();
		const cleanup = () => requestSignal.removeEventListener("abort", abort);
		requestSignal.addEventListener("abort", abort, { once: true });

		try {
			const manager = getManager();
			let player = manager.getPlayer("webid");
			if (!player) {
				player = await manager.create("webid", {
					preload: { enabled: false },
					crossfade: { enabled: false },
				});
			}
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

			const contentType = stream.metadata?.mime || defaultContentType;
			const totalLength = stream.metadata?.contentLength ? Number(stream.metadata.contentLength) : undefined;
			const rangeHeader = context.req.header("range");
			const range = parseRange(rangeHeader, totalLength);

			if (range?.unsatisfiable) {
				stream.destroy();
				cleanup();
				return context.text("Requested range not satisfiable", 416, {
					...proxyCorsHeaders,
					"Content-Range": `bytes */${range.total}`,
				});
			}

			const headers = {
				...proxyCorsHeaders,
				"Content-Type": contentType,
				"Accept-Ranges": "bytes",
				"Cache-Control": "public, max-age=3600",
			};

			if (range && (range.start > 0 || range.end !== undefined || totalLength)) {
				const start = range.start;
				const end =
					range.end !== undefined ? range.end
					: totalLength ? totalLength - 1
					: undefined;
				const chunkLength = end !== undefined ? end - start + 1 : undefined;

				if (end !== undefined) {
					headers["Content-Range"] = `bytes ${start}-${end}/${totalLength || "*"}`;
					if (chunkLength !== undefined) headers["Content-Length"] = String(chunkLength);
				} else if (totalLength) {
					headers["Content-Range"] = `bytes ${start}-${totalLength - 1}/${totalLength}`;
					headers["Content-Length"] = String(totalLength - start);
				}

				let responseStream = stream;
				if (start > 0 || (end !== undefined && totalLength && end < totalLength - 1)) {
					responseStream = createRangeStream(stream, start, end);
				}

				return context.body(Readable.toWeb(responseStream), 206, headers);
			}

			if (totalLength) {
				headers["Content-Length"] = String(totalLength);
			}

			return context.body(Readable.toWeb(stream), 200, headers);
		} catch (error) {
			cleanup();
			if (controller.signal.aborted || requestSignal?.aborted) return;
			logger()?.error(`[Stream] ${logLabel} error:`, error);
			return context.json({ error: errorMessage }, 500, proxyCorsHeaders);
		}
	};
}

router.options("/audio", (context) => context.body(null, 204, proxyCorsHeaders));
router.options("/video", (context) => context.body(null, 204, proxyCorsHeaders));
router.get("/audio", streamRoute("save", "audio/webm", "Audio", "Audio stream failed"));
router.get("/video", streamRoute("saveVideo", "video/mp4", "Video", "Video stream failed"));

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
		const attachWeb = body.mode !== "voice";
		if (target === "discord") await adoptDiscordPlayer(userId, player, playerId, { web: attachWeb });
		else if (attachWeb) await ensureWebAudioPublisher(player, userId);
		const result = await player.play(body.query.trim(), { requestedBy: userId });
		if (!result) return context.json({ error: "No playable track found for this query" }, 422);
		if (body.positionMs > 0 && !(await player.seek(body.positionMs))) {
			return context.json({ error: "Track started but the requested position could not be applied" }, 409);
		}
		return context.json({
			sessionId: streamSessionId(userId),
			playerId,
			target,
			track: {
				title: result.track?.title ?? body.query.trim(),
				url: result.track?.url ?? null,
				...(result.track?.thumbnail ? { thumbnail: result.track.thumbnail } : {}),
				...(result.track?.author || result.track?.metadata?.author ?
					{ author: result.track.author ?? result.track.metadata?.author }
				:	{}),
				...(result.track?.duration !== undefined ? { duration: result.track.duration } : {}),
			},
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
	let player = getSelectedPlayer(userId);
	if (!player) {
		const voiceState = await getUserVoiceState(userId);
		const found = findUserDiscordPlayer(userId, voiceState);
		if (found?.player) {
			player = found.player;
			selectedPlayers.set(userId, found.playerId);
		}
	}
	if (!player) return context.json({ error: "No browser playback session exists" }, 404);

	try {
		if (body.mode === "web") {
			const channelMembers = [...(player.userdata?.voiceChannel?.members?.values?.() ?? [])].filter(
				(member) => !member.user?.bot && member.id !== userId,
			);
			const isAloneInVoice = channelMembers.length === 0;
			const isRequester = player.userdata?.requestedBy?.id === userId || player.userdata?.webAudioStream?.userId === userId;
			const canSwitch = isAloneInVoice || isRequester;

			if (player.connection && !canSwitch && channelMembers.length > 0) {
				return context.json(
					{
						error:
							"This is a shared Discord player. Choose Browser-only before starting playback to keep the voice connection unchanged.",
					},
					409,
				);
			}
			if (player.connection) await player.disconnect();
			clearVoiceMetadata(player);
			const existingWebPlayer = manager.getPlayer(sessionId);
			if (existingWebPlayer && existingWebPlayer !== player) {
				await manager.destroy(sessionId).catch(() => {});
			}
			renamePlayer(player, sessionId);
			selectedPlayers.set(userId, player.id);
			// Switching to web: register browser output so the audio reaches the browser
			await ensureWebAudioPublisher(player, userId);
			return context.json({ sessionId, mode: "web", playerId: player.id });
		}

		const voiceState = await getUserVoiceState(userId);
		const found = findUserDiscordPlayer(userId, voiceState);

		// Already on the Discord player of the user's channel: nothing to connect.
		if (found && found.player === player) {
			selectedPlayers.set(userId, found.playerId);
			await detachWebAudio(userId);
			return context.json({
				sessionId,
				mode: "voice",
				playerId: found.playerId,
				channel: describeVoiceChannel(player, voiceState),
			});
		}
		if (!voiceState?.channelId || !voiceState?.guildId) {
			return context.json({ error: "Join a voice channel before switching playback to voice" }, 409);
		}

		// A Discord player already exists in this channel: join it (the browser player is released).
		if (found) {
			const carried = captureBrowserPlayback(userId, found.player);
			await adoptDiscordPlayer(userId, found.player, found.playerId, { web: false });
			const carriedOver = await carryPlaybackOver(userId, found.player, carried);
			return context.json({
				sessionId,
				mode: "voice",
				playerId: found.playerId,
				carried: carriedOver,
				channel: describeVoiceChannel(found.player, voiceState),
			});
		}

		const playerCreate = useHooks.get("functions")?.get("playerCreate");
		if (typeof playerCreate?.getBot !== "function" || typeof playerCreate?.createPlayer !== "function") {
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

		const user = await useHooks
			.get("client")
			?.users?.fetch(userId)
			.catch(() => null);
		if (!user) return context.json({ error: "Could not resolve your Discord account" }, 502);
		const lang = await useHooks.get("functions")?.get("ZiRank")?.execute({ user, XpADD: 0 });

		// Give the browser player the canonical id (queue, track and position stay untouched) so
		// `createPlayer` below reuses this very player and just connects it to the voice channel.
		const canonicalId = `${voiceState.guildId}::${voiceState.channelId}`;
		const renamed = !player.connection && player.id !== canonicalId && renamePlayer(player, canonicalId);
		if (renamed) selectedPlayers.set(userId, canonicalId);

		let discordPlayer;
		try {
			discordPlayer = await playerCreate.createPlayer({
				guildId: voiceState.guildId,
				voiceChannelId: voiceState.channelId,
				textChannel: voiceChannel,
				requestedBy: user,
				reply: null,
				message: null,
				customId: null,
				lang,
				options: { assistant: false },
			});
		} catch (error) {
			if (renamed) renamePlayer(player, sessionId); // undo: stay a browser-only player
			selectedPlayers.set(userId, player.id);
			throw error;
		}
		if (!discordPlayer?.connection) {
			if (renamed) renamePlayer(player, sessionId); // undo: stay a browser-only player
			selectedPlayers.set(userId, player.id);
			return context.json({ error: "The bot could not join your voice channel" }, 502);
		}

		const discordPlayerId = discordPlayer.id ?? `${voiceState.guildId}::${voiceState.channelId}`;
		const carried = captureBrowserPlayback(userId, discordPlayer);
		await adoptDiscordPlayer(userId, discordPlayer, discordPlayerId, { web: false });
		const carriedOver = await carryPlaybackOver(userId, discordPlayer, carried);
		return context.json({
			sessionId,
			mode: "voice",
			playerId: discordPlayerId,
			carried: carriedOver,
			renamed,
			channel: { id: voiceChannel.id, name: voiceChannel.name },
		});
	} catch (error) {
		logger()?.error(`[ZiPlayer Stream] Failed to switch output to ${body.mode}:`, error);
		return context.json({ error: error.message || "Could not switch playback output" }, error.statusCode ?? 500);
	}
});

async function getPlayersPayload(userId) {
	const sessionId = streamSessionId(userId);
	const voiceState = await getUserVoiceState(userId);
	const found = findUserDiscordPlayer(userId, voiceState);
	const webPlayer = getBrowserPlayer(userId);
	const publisher = publisherConnections.get(sessionId);
	const attachedPlayer = publisher?.socket.readyState === WebSocket.OPEN ? publisher.player : null;
	const selectedId = selectedPlayers.get(userId) ?? null;

	const discordTrack = found ? safeCurrentTrack(found.player) : null;
	const browserTrack = webPlayer ? safeCurrentTrack(webPlayer) : null;
	const browserOnly = webPlayer && !webPlayer.connection ? webPlayer : null;

	return {
		sessionId,
		voice:
			voiceState?.channelId ?
				{ guildId: voiceState.guildId, channelId: voiceState.channelId, name: voiceState.channel?.name ?? null }
			:	null,
		discord:
			found ?
				{
					playerId: found.playerId,
					channel: describeVoiceChannel(found.player, voiceState),
					playing: Boolean(discordTrack),
					track: serializeTrack(discordTrack),
					attached: attachedPlayer === found.player,
				}
			:	null,
		browser:
			browserOnly ?
				{
					playerId: browserOnly.id,
					playing: Boolean(browserTrack),
					track: serializeTrack(browserTrack),
					attached: attachedPlayer === browserOnly,
				}
			:	null,
		selected: selectedId,
		selectedTarget:
			!selectedId ? null
			: found && selectedId === found.playerId ? "discord"
			: webPlayer && selectedId === webPlayer.id ? "browser"
			: null,
	};
}

router.get("/players", authenticate, async (context) => {
	const userId = getUserId(context.get("streamUser"));
	const sessionId = streamSessionId(userId);

	const acceptHeader = context.req.header("accept") || "";
	const wantsJson =
		context.req.query("sse") === "false" ||
		(acceptHeader.includes("application/json") && !acceptHeader.includes("text/event-stream"));

	if (wantsJson) {
		try {
			const payload = await getPlayersPayload(userId);
			return context.json(payload);
		} catch (error) {
			logger()?.error("[ZiPlayer Stream] Failed to list players:", error);
			return context.json({ error: error.message || "Could not list players" }, error.statusCode ?? 500);
		}
	}

	return streamSSE(context, async (stream) => {
		const unsubscribers = [];
		let closed = false;
		let writeQueue = Promise.resolve();
		let heartbeat;
		let resolveAbort;
		const aborted = new Promise((resolve) => {
			resolveAbort = resolve;
		});

		let lastPayloadString = "";

		const enqueue = (write) => {
			writeQueue = writeQueue
				.then(async () => {
					if (!closed && !stream.aborted && !stream.closed) await write();
				})
				.catch((error) => {
					logger()?.error(`[ZiPlayer Stream] Failed to write players SSE for ${sessionId}:`, error);
					stream.abort();
				});
		};

		const publishPlayers = async (force = false) => {
			try {
				const payload = await getPlayersPayload(userId);
				const payloadString = JSON.stringify(payload);
				if (!force && payloadString === lastPayloadString) return;
				lastPayloadString = payloadString;

				enqueue(() =>
					stream.writeSSE({
						retry: 3000,
						event: "stream-players",
						data: payloadString,
					}),
				);
			} catch (err) {
				logger()?.error(`[ZiPlayer Stream] Error publishing players for ${sessionId}:`, err);
			}
		};

		const onAbort = () => {
			if (closed) return;
			closed = true;
			clearInterval(heartbeat);
			for (const unsubscribe of unsubscribers) {
				try {
					unsubscribe();
				} catch {}
			}
			resolveAbort();
		};

		stream.onAbort(onAbort);

		// Send initial players info immediately
		await publishPlayers(true);

		const subscribePlayer = (p) => {
			if (!p || typeof p.subscribe !== "function") return;
			for (const eventName of [
				"TRACK_STARTED",
				"TRACK_END",
				"playbackStateChanged",
				"playerPause",
				"playerResume",
				"playerStop",
				"destroyed",
			]) {
				unsubscribers.push(p.subscribe(eventName, () => void publishPlayers()));
			}
		};

		const manager = getManager();
		if (manager && typeof manager.on === "function") {
			const onLifecycle = (p) => {
				void publishPlayers();
				subscribePlayer(p);
			};
			manager.on("playerCreate", onLifecycle);
			manager.on("playerDestroy", onLifecycle);
			unsubscribers.push(() => {
				manager.off("playerCreate", onLifecycle);
				manager.off("playerDestroy", onLifecycle);
			});
		}

		// Subscribe to current players
		try {
			const voiceState = await getUserVoiceState(userId);
			const found = findUserDiscordPlayer(userId, voiceState);
			const webPlayer = getBrowserPlayer(userId);
			if (found?.player) subscribePlayer(found.player);
			if (webPlayer) subscribePlayer(webPlayer);
		} catch (err) {
			logger()?.warn?.(`[ZiPlayer Stream] Could not attach player listeners for ${sessionId}:`, err);
		}

		if (!closed) {
			heartbeat = setInterval(async () => {
				if (closed || stream.aborted || stream.closed) return;
				await publishPlayers(false);
				enqueue(() => stream.write(": keep-alive\n\n"));
			}, 3000);
			heartbeat.unref?.();
		}

		await aborted;
	});
});

router.post("/attach", authenticate, async (context) => {
	const body = context.get("body") ?? {};
	const userId = getUserId(context.get("streamUser"));
	const sessionId = streamSessionId(userId);
	try {
		const voiceState = await getUserVoiceState(userId);
		const found = findUserDiscordPlayer(userId, voiceState);
		if (!found) {
			return context.json(
				{ error: "No active Discord player was found in your current voice channel", code: "NO_DISCORD_PLAYER" },
				404,
			);
		}

		const carried = captureBrowserPlayback(userId, found.player);
		if (carried && body.migrate !== true) {
			return context.json(
				{
					error: "Your browser-only player is still playing. Confirm to move it to the Discord player.",
					code: "BROWSER_PLAYER_ACTIVE",
				},
				409,
			);
		}

		await adoptDiscordPlayer(userId, found.player, found.playerId);
		const carriedOver = await carryPlaybackOver(userId, found.player, carried);
		return context.json({
			sessionId,
			playerId: found.playerId,
			target: "discord",
			carried: carriedOver,
			channel: describeVoiceChannel(found.player, voiceState),
		});
	} catch (error) {
		logger()?.error("[ZiPlayer Stream] Failed to attach to the Discord player:", error);
		return context.json({ error: error.message || "Could not attach to the Discord player" }, error.statusCode ?? 500);
	}
});

router.get("/state", authenticate, async (context) => {
	const userId = getUserId(context.get("streamUser"));
	const sessionId = streamSessionId(userId);
	const player = getSelectedPlayer(userId);
	if (!player) return context.json({ error: "No stream player exists" }, 404);

	const getState = () => ({
		sessionId,
		playerId: player.id,
		target: player.connection ? "discord" : "browser",
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

module.exports.releaseWebVoiceConflicts = async function releaseWebVoiceConflicts(voiceChannelId, canonicalPlayerId) {
	const manager = getManager();
	if (!manager || !voiceChannelId) return 0;
	let released = 0;
	for (const candidate of manager.getPlayersInChannel?.(voiceChannelId) ?? []) {
		if (!isWebStreamPlayerId(candidate?.id) || candidate.id === canonicalPlayerId) continue;
		try {
			await candidate.disconnect();
			clearVoiceMetadata(candidate);
			released++;
		} catch (error) {
			logger()?.error(`[ZiPlayer Stream] Failed to release ${candidate.id} from voice:`, error);
		}
	}
	return released;
};

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
