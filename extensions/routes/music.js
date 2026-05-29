const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { lyricsExt } = require("@ziplayer/extension");
const { joinVoiceChannel } = require("@discordjs/voice");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();

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
		if (voiceStates && voiceStates.has(userId)) {
			const vs = voiceStates.get(userId);
			voiceChannel = vs.channel;
		}
		if (!voiceChannel) {
			const client = useHooks.get("client");
			if (client) {
				for (const [guildId, guild] of client.guilds.cache) {
					const member = guild.members.cache.get(userId);
					if (member && member.voice && member.voice.channel) {
						voiceChannel = member.voice.channel;
						break;
					}
				}
			}
		}
		if (!voiceChannel) {
			return res.status(400).json({ error: "User is not in a voice channel" });
		}
		// console.log(voiceChannel);
		const manager = getManager();
		const client = useHooks.get("client");
		const userd = await client.users.fetch(req.user.id);
		let player = null;
		const userData = manager.getall().find((node) => node?.userdata?.listeners?.some((l) => l.id === user.id));
		if (userData) {
			player = userData;
			useHooks.get("logger").debug(`[Player] Found active player for ${userd.username}`);
		} else {
			player = await manager.create(voiceChannel.guildId, {
				selfDeaf: true,
				volume: 50,
				leaveOnEmpty: true,
				leaveOnEmptyCooldown: 50_000,
				leaveOnEnd: true,
				leaveOnEndCooldown: 500_000,
				pauseOnEmpty: true,
				extensions: [
					"lyricsExt",
					// "lavalinkExt"
				],
				userdata: { 
					channel: voiceChannel, 
					voiceChannel: voiceChannel, 
					client: client, 
					listeners: [userd],
					LockStatus: false,
					requestedBy: userd,
				},
			});
			useHooks.get("logger").debug(`[Player] Created new player for ${userd.username}`);
		}
		if (!player.connection) await player.connect(voiceChannel);
		res.status(200).json({
			status: "ok",
			channel: voiceChannel.name,
			user: userd.username,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/", router);
	return;
};
