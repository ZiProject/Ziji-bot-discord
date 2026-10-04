const { Hono } = require("hono");
const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { lyricsExt } = require("@ziplayer/extension");
const jwt = require("jsonwebtoken");
const { spawn, execFile } = require("node:child_process");
const router = new Hono();

const Kuroshiro = require("kuroshiro").default;
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
const kuroshiro = new Kuroshiro();
let kuroshiroInited = false;

module.exports.data = {
	name: "musicRoutes",
	description: "Music route for querying tracks",
	version: "1.0.0",
	enable: true,
	priority: 9,
};

const authenticate = async (context, next) => {
	const authHeader = context.req.header("authorization");
	if (!authHeader) return context.html("No token provided", 401);

	let user;
	try {
		user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
	} catch {
		return context.html("Invalid token", 401);
	}
	context.set("user", user);
	await next();
};

router.get("/music/search", authenticate, async (context) => {
	try {
		const { q, source = "youtube" } = context.req.query();
		if (!q) return context.json({ error: "Missing query" }, 400);
		const result = await getManager().search(q, source);
		return context.json({ results: result.tracks, total: result.tracks.length });
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

router.get("/music/lyrics", authenticate, async (context) => {
	try {
		const { query, q } = context.req.query();
		const title = query || q;
		if (!title) return context.json({ error: "Missing query" }, 400);

		const lyrics = await new lyricsExt().fetch({ title });
		if (!kuroshiroInited) {
			await kuroshiro.init(new KuromojiAnalyzer());
			kuroshiroInited = true;
		}

		let romanizedLyrics = null;
		if (lyrics.synced) {
			const lines = lyrics.synced.split("\n");
			const processedLines = await Promise.all(
				lines.map(async (line) => {
					const match = line.match(/^(\[\d{2}:\d{2}\.\d{2}\])(.*)$/);
					if (match) {
						const [, timestamp, text] = match;
						const romanizedText = await kuroshiro.convert(text, {
							to: "romaji",
							mode: "spaced",
							romajiSystem: "hepburn",
						});
						return `${timestamp}${romanizedText}`;
					}
					return kuroshiro.convert(line, {
						to: "romaji",
						mode: "spaced",
						romajiSystem: "hepburn",
					});
				}),
			);
			romanizedLyrics = processedLines.join("\n");
		}

		return context.json({ ...lyrics, lyrics_romanization: romanizedLyrics });
	} catch (error) {
		return context.json({ error: error.message }, 500);
	}
});

router.post("/music/join", authenticate, async (context) => {
	try {
		const userId = context.get("user")?.id;
		if (!userId) return context.json({ error: "Unauthorized: Invalid user data" }, 401);

		let voiceChannel = null;
		const voiceStates = useHooks.get("voiceStates");
		if (voiceStates?.has(userId)) voiceChannel = voiceStates.get(userId)?.channel;

		if (!voiceChannel) {
			const client = useHooks.get("client");
			for (const guild of client.guilds.cache.values()) {
				try {
					const member = await guild.members.fetch(userId);
					if (member?.voice?.channel) {
						voiceChannel = member.voice.channel;
						voiceStates?.set(userId, {
							channelId: member.voice.channel.id,
							guildId: guild.id,
							channel: member.voice.channel,
						});
						break;
					}
				} catch {
					continue;
				}
			}
		}

		if (!voiceChannel) return context.json({ error: "User is not in a voice channel" }, 400);

		const client = useHooks.get("client");
		const user = await client.users.fetch(userId);
		const playerCreate = useHooks.get("functions").get("playerCreate");
		if (!playerCreate?.createPlayer) return context.json({ error: "playerCreate function not found" }, 500);

		const lang = await useHooks.get("functions").get("ZiRank").execute({ user, XpADD: 0 });
		const player = await playerCreate.createPlayer({
			guildId: voiceChannel.guild.id,
			voiceChannelId: voiceChannel.id,
			textChannel: voiceChannel,
			requestedBy: user,
			reply: null,
			message: null,
			customId: null,
			lang,
			options: { assistant: false },
		});

		return context.json({
			status: "ok",
			channel: voiceChannel.name,
			user: user.username,
			playerId: player?.id,
		});
	} catch (error) {
		useHooks.get("logger").error(`[API] /music/join ${error.stack || error}`);
		return context.json({ error: error.message }, 500);
	}
});

const extractRawUrl = (context) => {
	let targetUrl = context.req.query("url");
	if (typeof targetUrl !== "string" && !context.req.query("id")) return null;

	const requestUrl = context.req.url;
	if (requestUrl.includes("url=")) {
		const rawPart = requestUrl.substring(requestUrl.indexOf("url=") + 4);
		if (/^https?%3A/i.test(rawPart)) {
			try {
				targetUrl = decodeURIComponent(rawPart);
			} catch {
				targetUrl = rawPart;
			}
		} else if (rawPart.startsWith("http://") || rawPart.startsWith("https://")) {
			targetUrl = rawPart;
		}
	}
	return targetUrl;
};

router.get("/proxy/image", async (context) => {
	const url = extractRawUrl(context);
	if (!url) return context.json({ error: "Missing url" }, 400);

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});
		if (!response.ok || !response.body) return context.html("Failed to fetch image", response.status);

		return context.body(response.body, 200, {
			"Content-Type": response.headers.get("content-type") || "image/jpeg",
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
		});
	} catch (error) {
		console.error("[ProxyImage]: Error:", error);
		return context.json({ error: "Proxy error" }, 500);
	}
});

router.get("/music/video/url", async (context) => {
	const id = context.req.query("id");
	if (!id) return context.json({ error: "Missing video ID" }, 400);

	try {
		const ytTarget = id.startsWith("http://") || id.startsWith("https://") ? id : `https://www.youtube.com/watch?v=${id}`;
		const { stdout } = await new Promise((resolve, reject) => {
			execFile("yt-dlp", ["--no-warnings", "-g", ytTarget], (error, stdout, stderr) => {
				if (error) reject(Object.assign(error, { stderr }));
				else resolve({ stdout });
			});
		});
		const urls = stdout.trim().split(/\r?\n/).filter(Boolean);
		if (!urls.length) return context.json({ error: "No stream URL found." }, 404);

		return context.json({
			success: true,
			video: urls[0] || null,
			audio: urls[1] || urls[0] || null,
			urls,
		});
	} catch (error) {
		console.error("[API] [yt-dlp]: Execution error", error, error.stderr);
		return context.json({ error: "Error while executing download process on the server-side." }, 500);
	}
});

const rewriteM3U8 = (content, baseUrl, proxyPrefix) => {
	return content
		.split(/\r?\n/)
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return line;
			if (trimmed.startsWith("#")) {
				return line.replace(/URI="([^"]+)"/g, (match, uri) => {
					try {
						return `URI="${proxyPrefix}${encodeURIComponent(new URL(uri, baseUrl).href)}"`;
					} catch {
						return match;
					}
				});
			}
			try {
				return `${proxyPrefix}${encodeURIComponent(new URL(trimmed, baseUrl).href)}`;
			} catch {
				return line;
			}
		})
		.join("\n");
};

const proxyCorsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Allow-Headers": "*",
	"Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

const forwardResponseBody = (source, abortController, cleanup) => {
	const reader = source.getReader();
	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					cleanup();
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (error) {
				cleanup();
				controller.error(error);
			}
		},
		async cancel(reason) {
			abortController.abort();
			try {
				await reader.cancel(reason);
			} finally {
				cleanup();
			}
		},
	});
};

router.options("/proxy/stream", (context) => context.body(null, 204, proxyCorsHeaders));

router.get("/proxy/stream", async (context) => {
	const videoId = context.req.query("id");
	let videoUrl = extractRawUrl(context);
	if (!videoUrl && !videoId) return context.json({ error: "Missing url or id parameter..." }, 400, proxyCorsHeaders);

	const abortController = new AbortController();
	const requestSignal = context.req.raw.signal;
	const abort = () => abortController.abort();
	const cleanup = () => requestSignal.removeEventListener("abort", abort);
	let streamingResponse = false;
	requestSignal.addEventListener("abort", abort, { once: true });

	try {
		if (!videoUrl || videoUrl.includes("youtube.com/watch") || videoUrl.includes("youtu.be/")) {
			const ytTarget = videoUrl || (videoId.startsWith("http") ? videoId : `https://www.youtube.com/watch?v=${videoId}`);
			const urls = await new Promise((resolve, reject) => {
				const child = spawn("yt-dlp", ["--no-warnings", "-g", ytTarget]);
				let stdout = "";
				let stderr = "";
				child.stdout.on("data", (data) => (stdout += data.toString()));
				child.stderr.on("data", (data) => (stderr += data.toString()));
				child.on("close", (code) => {
					if (code !== 0) reject(new Error(stderr || `yt-dlp exited with code ${code}`));
					else resolve(stdout.trim().split(/\r?\n/).filter(Boolean));
				});
				child.on("error", reject);
				abortController.signal.addEventListener("abort", () => child.kill(), { once: true });
			});
			if (!urls.length) return context.json({ error: "Could not extract stream URL" }, 404, proxyCorsHeaders);
			videoUrl = context.req.query("type") === "audio" ? urls[1] || urls[0] : urls[0];
		}

		const headers = {
			Accept: "*/*",
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			Referer: "https://www.youtube.com/",
			Origin: "https://www.youtube.com",
			Connection: "keep-alive",
		};
		const range = context.req.header("range");
		if (range) headers.Range = range;

		const response = await fetch(videoUrl, {
			method: "GET",
			headers,
			signal: abortController.signal,
		});

		if (!response.ok && response.status !== 206) {
			return context.json(
				{ code: response.status, error: `Cannot stream from URL (HTTP ${response.status})` },
				response.status,
				proxyCorsHeaders,
			);
		}

		const contentType = (response.headers.get("content-type") || "").toLowerCase();
		const urlWithoutQuery = videoUrl.split("?")[0];
		const isSegment =
			urlWithoutQuery.endsWith(".ts") ||
			videoUrl.includes("/file/seg.ts") ||
			videoUrl.includes("mime=video") ||
			videoUrl.includes("mime=audio");
		const isM3U8 =
			!isSegment &&
			(contentType.includes("mpegurl") || contentType.includes("application/x-mpegurl") || urlWithoutQuery.endsWith(".m3u8"));

		if (isM3U8) {
			const rawText = await response.text();
			if (rawText.trim().startsWith("#EXTM3U")) {
				const rewritten = rewriteM3U8(rawText, videoUrl, "/proxy/stream?url=");
				return context.text(rewritten, 200, {
					...proxyCorsHeaders,
					"Content-Type": "application/vnd.apple.mpegurl",
					"Content-Length": Buffer.byteLength(rewritten).toString(),
				});
			}
			return context.text(rawText, response.status, {
				...proxyCorsHeaders,
				"Content-Type": contentType || "text/plain",
			});
		}

		const forwardedHeaders = { ...proxyCorsHeaders };
		for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
			const value = response.headers.get(header);
			if (value) forwardedHeaders[header] = value;
		}
		if (!response.body) return context.body(null, response.status, forwardedHeaders);

		streamingResponse = true;
		return context.body(forwardResponseBody(response.body, abortController, cleanup), response.status, forwardedHeaders);
	} catch (error) {
		if (error.name === "AbortError" || abortController.signal.aborted) return;
		console.error("[StreamProxy]:", error);
		return context.json({ error: "Error on server-side." }, 500, proxyCorsHeaders);
	} finally {
		if (!streamingResponse) cleanup();
	}
});

module.exports.execute = () => {
	useHooks.get("server").route("/", router);
};
