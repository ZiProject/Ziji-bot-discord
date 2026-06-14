const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { lyricsExt } = require("@ziplayer/extension");
const { joinVoiceChannel } = require("@discordjs/voice");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const { pipeline } = require("stream/promises");

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
		res.json(lyrics);
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

router.get("/proxy/image", async (req, res) => {
	const url = req.query.url;

	if (!url) {
		return res.status(400).json({
			error: "Missing url",
		});
	}

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});

		if (!response.ok || !response.body) {
			return res.status(response.status).send("Failed to fetch image");
		}

		res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");

		res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");

		await pipeline(response.body, res);
	} catch (err) {
		console.error(err);

		res.status(500).json({
			error: "Proxy error",
		});
	}
});

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/", router);
	return;
};
