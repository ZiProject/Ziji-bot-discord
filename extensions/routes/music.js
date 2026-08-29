const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { lyricsExt } = require("@ziplayer/extension");
const { joinVoiceChannel } = require("@discordjs/voice");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
const { spawn, execFile } = require("child_process");


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

const authenticate = (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.status(401).send("No token provided");
	const token = authHeader.split(" ")[1];
	// console.log(token);
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		next();
	} catch (error) {
		res.status(401).send("Invalid token");
	}
};

router.get("/music/search", authenticate, async (req, res) => {
	try {
		const { q, source = "youtube" } = req.query;
		if (!q) return res.status(400).json({ error: "Missing query" });
		const manager = getManager();
		const result = await manager.search(q, source);
		res.json({ results: result.tracks, total: result.tracks.length });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/music/lyrics", authenticate, async (req, res) => {
	try {
		const q = req.query?.query || req.query?.q;
		if (!q) return res.status(400).json({ error: "Missing query" });
		const lyricsext = new lyricsExt();
		const lyrics = await lyricsext.fetch({ title: q });

		if (!kuroshiroInited) {
			await kuroshiro.init(new KuromojiAnalyzer());
			kuroshiroInited = true;
		}

		let romanizedLyrics = null;

		if (lyrics.synced) {
			// Tách thành từng dòng
			const lines = lyrics.synced.split("\n");

			const processedLines = await Promise.all(
				lines.map(async (line) => {
					// Regex bóc tách phần timestamp [00:00.00] và phần text riêng
					const match = line.match(/^(\[\d{2}:\d{2}\.\d{2}\])(.*)$/);

					if (match) {
						const [, timestamp, text] = match;
						// Chỉ cho phần text qua kuroshiro với mode: spaced
						const romanizedText = await kuroshiro.convert(text, {
							to: "romaji",
							mode: "spaced",
							romajiSystem: "hepburn",
						});
						return `${timestamp}${romanizedText}`;
					}

					// Nếu dòng không chứa timestamp (dòng trống hoặc header), convert bình thường
					return await kuroshiro.convert(line, {
						to: "romaji",
						mode: "spaced",
						romajiSystem: "hepburn",
					});
				}),
			);

			romanizedLyrics = processedLines.join("\n");
		}

		res.json({ ...lyrics, lyrics_romanization: romanizedLyrics });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/music/join", authenticate, async (req, res) => {
	try {
		const userId = req.user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized: Invalid user data" });
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

						if (voiceStates) {
							voiceStates.set(userId, {
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

		if (!voiceChannel) {
			return res.status(400).json({
				error: "User is not in a voice channel",
			});
		}

		const client = useHooks.get("client");
		const user = await client.users.fetch(userId);

		const playerCreate = useHooks.get("functions").get("playerCreate");

		if (!playerCreate?.createPlayer) return res.status(500).json({ error: "playerCreate function not found" });

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

			options: {
				assistant: false,
			},
		});

		res.status(200).json({
			status: "ok",
			channel: voiceChannel.name,
			user: user.username,
			playerId: player?.id,
		});
	} catch (error) {
		useHooks.get("logger").error(`[API] /music/join ${error.stack || error}`);

		res.status(500).json({
			error: error.message,
		});
	}
});

const extractRawUrl = (req) => {
	let targetUrl = req.query.url;
	if (typeof targetUrl !== "string" && !req.query.id) return null;

	if (req.originalUrl && req.originalUrl.includes("url=")) {
		const rawPart = req.originalUrl.substring(req.originalUrl.indexOf("url=") + 4);
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

router.get("/proxy/image", async (req, res) => {
	const url = extractRawUrl(req);

	if (!url) {
		return res.status(400).json({
			error: "Missing url",
		});
	}

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok || !response.body) {
			return res.status(response.status).send("Failed to fetch image");
		}

		res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
		res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

		const nodeStream = Readable.fromWeb(response.body);
		await pipeline(nodeStream, res);
	} catch (err) {
		console.error("[ProxyImage]: Error:", err);
		if (!res.headersSent) {
			res.status(500).json({
				error: "Proxy error",
			});
		}
	}
});

router.get("/music/video/url", async (req, res) => {
	const id = req.query.id;
	if (!id) {
		return res.status(400).json({
			error: "Missing video ID",
		});
	}

	try {
		const ytTarget = id.startsWith("http://") || id.startsWith("https://")
			? id
			: `https://www.youtube.com/watch?v=${id}`;

		execFile("yt-dlp", ["--no-warnings", "-g", ytTarget], (error, stdout, stderr) => {
			if (error) {
				console.error(`[API] [yt-dlp]: Execution error`, error, stderr);
				return res.status(500).json({
					error: "Error while executing download process on the server-side.",
				});
			}

			const urls = stdout.trim().split(/\r?\n/).filter(Boolean);
			if (!urls.length) {
				return res.status(404).json({
					error: "No stream URL found.",
				});
			}

			res.status(200).json({
				success: true,
				video: urls[0] || null,
				audio: urls[1] || urls[0] || null,
				urls: urls,
			});
		});
	} catch (err) {
		console.error("[API]: Error: ", err);
		res.status(500).json({
			error: "Error on server-side.",
		});
	}
});

const rewriteM3U8 = (content, baseUrl, proxyPrefix) => {
	const lines = content.split(/\r?\n/);
	const rewritten = lines.map((line) => {
		const trimmed = line.trim();
		if (!trimmed) return line;

		if (trimmed.startsWith("#")) {
			// Rewrite URI="..." in tags like #EXT-X-MAP, #EXT-X-KEY, #EXT-X-MEDIA
			return line.replace(/URI="([^"]+)"/g, (match, uri) => {
				try {
					const abs = new URL(uri, baseUrl).href;
					return `URI="${proxyPrefix}${encodeURIComponent(abs)}"`;
				} catch {
					return match;
				}
			});
		}

		// Segment URI or sub-playlist URI line
		try {
			const abs = new URL(trimmed, baseUrl).href;
			return `${proxyPrefix}${encodeURIComponent(abs)}`;
		} catch {
			return line;
		}
	});

	return rewritten.join("\n");
};

router.options("/proxy/stream", (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "*");
	res.sendStatus(204);
});

router.get("/proxy/stream", async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "*");
	res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type");

	let videoUrl = extractRawUrl(req);
	const videoId = req.query.id;

	if (!videoUrl && !videoId) {
		return res.status(400).json({ error: "Missing url or id parameter..." });
	}

	// AbortController is required to kill the remote fetch when the user leaves/pauses
	const abortController = new AbortController();

	req.on("close", () => {
		abortController.abort();
	});

	try {
		// If videoUrl is a YouTube URL or if only videoId was passed, dynamically resolve stream URL
		if (!videoUrl || videoUrl.includes("youtube.com/watch") || videoUrl.includes("youtu.be/")) {
			const ytTarget = videoUrl || (videoId.startsWith("http") ? videoId : `https://www.youtube.com/watch?v=${videoId}`);
			const urls = await new Promise((resolve, reject) => {
				const child = spawn("yt-dlp", ["--no-warnings", "-g", ytTarget]);
				let stdout = "";
				let stderr = "";
				child.stdout.on("data", (d) => (stdout += d.toString()));
				child.stderr.on("data", (d) => (stderr += d.toString()));
				child.on("close", (code) => {
					if (code !== 0) return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
					resolve(stdout.trim().split(/\r?\n/).filter(Boolean));
				});
			});

			if (!urls.length) {
				return res.status(404).json({ error: "Could not extract stream URL" });
			}

			videoUrl = req.query.type === "audio" ? (urls[1] || urls[0]) : urls[0];
		}

		const headers = {
			"Accept": "*/*",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Referer": "https://www.youtube.com/",
			"Origin": "https://www.youtube.com",
			"Connection": "keep-alive",
		};

		// Pass down incoming range (crucial for seeking & buffering audio/video)
		if (req.headers.range) {
			headers["Range"] = req.headers.range;
		}

		const response = await fetch(videoUrl, {
			method: "GET",
			headers: headers,
			signal: abortController.signal,
		});

		// 200 = Full Video, 206 = Video Chunk/Partial Content
		if (!response.ok && response.status !== 206) {
			return res.status(response.status).json({
				code: response.status,
				error: `Cannot stream from URL (HTTP ${response.status})`,
			});
		}

		const contentType = (response.headers.get("content-type") || "").toLowerCase();
		const urlWithoutQuery = videoUrl.split("?")[0];
		const isSegment = urlWithoutQuery.endsWith(".ts") || videoUrl.includes("/file/seg.ts") || videoUrl.includes("mime=video") || videoUrl.includes("mime=audio");
		const isM3U8 = !isSegment && (contentType.includes("mpegurl") || contentType.includes("application/x-mpegurl") || urlWithoutQuery.endsWith(".m3u8"));

		if (isM3U8) {
			const rawText = await response.text();
			if (rawText.trim().startsWith("#EXTM3U")) {
				const proxyPrefix = "/proxy/stream?url=";
				const rewritten = rewriteM3U8(rawText, videoUrl, proxyPrefix);

				res.status(200);
				res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
				res.setHeader("Content-Length", Buffer.byteLength(rewritten));
				return res.send(rewritten);
			} else {
				res.status(response.status);
				res.setHeader("Content-Type", contentType || "text/plain");
				return res.send(rawText);
			}
		}

		// Set the correct status code (Express expects res.status(code))
		res.status(response.status);

		// Forward vital headers back to the browser
		const passHeaders = ["content-type", "content-length", "content-range", "accept-ranges"];
		passHeaders.forEach((header) => {
			const val = response.headers.get(header);
			if (val) {
				res.setHeader(header, val);
			}
		});

		if (response.body) {
			const nodeStream = Readable.fromWeb(response.body);
			nodeStream.pipe(res);

			// Clean up resources if the node stream encounters an error
			nodeStream.on("error", (err) => {
				console.error("[StreamProxy]: Node stream error", err.message);
				abortController.abort();
				if (!res.headersSent) res.end();
			});
		} else {
			res.end();
		}
	} catch (error) {
		// Ignore errors caused by intentional aborting when client disconnects
		if (error.name === "AbortError") {
			return;
		}

		console.error("[StreamProxy]: Error while processing stream", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Error on server-side." });
		}
	}
});
module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/", router);
	return;
};
