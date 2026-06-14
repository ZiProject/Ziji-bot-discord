const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const REDIRECT_URI = `${process.env.API_URL}/auth/discord/callback`;

module.exports.data = {
	name: "APIRoutes",
	description: "Bot web control",
	version: "2.0.0",
	enable: true,
	priority: 9,
};
/**
 *
 * @param { import ("discord.js").Client} client
 * @returns
 */
module.exports.execute = (client) => {
	const server = useHooks.get("server");

	router.get("/auth/discord/login", async (req, res) => {
		try {
			const url = `https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20email`;
			res.redirect(url);
		} catch (error) {
			console.error("[Bot API] Error fetching user guilds:", error);
			return res.status(500).json({
				success: false,
				error: error.message,
			});
		}
	});

	router.post("/auth/token", async (req, res) => {
		try {
			const { code } = req.body;
			if (!code) return res.status(400).json({ error: "Missing authorization code" });
			const tokenRes = await axios.post(
				"https://discord.com/api/oauth2/token",
				new URLSearchParams({
					client_id: client.user?.id,
					client_secret: process.env.DISCORD_CLIENT_SECRET,
					grant_type: "authorization_code",
					code,
				}),
				{ headers: { "Content-Type": "application/x-www-form-urlencoded" } },
			);

			const { access_token } = tokenRes.data;

			const userRes = await axios.get("https://discord.com/api/users/@me", {
				headers: { Authorization: `Bearer ${access_token}` },
			});
			const u = userRes.data;
			const db = useHooks.get("db");
			await db.ZiUser.findOneAndUpdate(
				{ userID: u.id },
				{
					$set: { username: u.username, avatar: u.avatar, lastLogin: new Date() },
					$inc: { loginCount: 1 },
					$setOnInsert: { userID: u.id, createdAt: new Date() },
				},
				{ upsert: true },
			);

			// JWT cùng cấu trúc với web dashboard — dùng chung được toàn bộ API
			const token = jwt.sign({ id: u.id, username: u.username, avatar: u.avatar }, process.env.JWT_SECRET, { expiresIn: "7d" });

			res.json({ token, user: { id: u.id, username: u.username, avatar: u.avatar } });
		} catch (err) {
			const status = err.response?.status || 500;
			useHooks.get("logger")?.error(`[API] /auth/token ${err.stack || err}`);
			res.status(status).json({ error: err.response?.data ?? err.message });
		}
	});

	router.get("/auth/discord/callback", async (req, res) => {
		const { code } = req.query;
		if (!code) return res.status(400).send("No code provided");

		try {
			const tokenResponse = await axios.post(
				"https://discord.com/api/oauth2/token",
				new URLSearchParams({
					client_id: client.user?.id,
					client_secret: process.env.DISCORD_CLIENT_SECRET,
					grant_type: "authorization_code",
					code: code.toString(),
					redirect_uri: REDIRECT_URI,
				}),
				{ headers: { "Content-Type": "application/x-www-form-urlencoded" } },
			);

			const { access_token } = tokenResponse.data;

			const userResponse = await axios.get("https://discord.com/api/users/@me", {
				headers: { Authorization: `Bearer ${access_token}` },
			});

			const userData = userResponse.data;

			//put guids to db
			const guild = await axios.get("https://discord.com/api/users/@me/guilds", {
				headers: { Authorization: `Bearer ${access_token}` },
			});

			const guildss = guild.data;

			const db = useHooks.get("db");
			await db.ZiUser.findOneAndUpdate(
				{ userID: userData.id },
				{
					userID: userData.id,
					username: userData.username,
					avatar: userData.avatar,
					guilds: guildss.map((g) => ({
						id: g.id,
						name: g.name,
						permissions: g.permissions,
						permissionsNew: g.permissions_new,
						owner: g.owner,
					})),
					lastLogin: new Date(),
					$inc: { loginCount: 1 },
					$setOnInsert: { createdAt: new Date() },
				},
				{ upsert: true },
			);

			const token = jwt.sign(
				{ id: userData.id, username: userData.username, avatar: userData.avatar }, //aaaaa
				process.env.JWT_SECRET,
				{
					expiresIn: "7d",
				},
			);

			// Redirect back to frontend with token
			// Using HashRouter so token is passed as query param which frontend will pick up
			res.redirect(`${process.env.DASHBOARD_URL}/#/login-success?token=${token}`);
		} catch (error) {
			console.error("Auth error:", error.response?.data || error.message);
			res.status(500).send("Authentication failed");
		}
	});

	router.get("/user/me", async (req, res) => {
		const authHeader = req.headers.authorization;
		if (!authHeader) return res.status(401).send("No token provided");

		const token = authHeader.split(" ")[1];
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const db = useHooks.get("db");
			const user = await db.ZiUser.findOne({ userID: decoded.id });

			res.json({
				id: decoded.id,
				username: decoded.username,
				avatar: decoded.avatar,
				// Mock DB data for preview
				level: user?.level || 1,
				coin: user?.coin || 0,
				xp: user?.xp || 0,
			});
		} catch (error) {
			console.error("Token error:", error.message);
			res.status(401).send("Invalid token");
		}
	});

	// --- NEW ROUTES FOR USER SETTINGS & GUILDS ---

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

	const checkGuildAccess = async (userId, guildId) => {
		const db = useHooks.get("db");
		const user = await db.ZiUser.findOne({ userID: userId });
		const guild = user?.guilds?.find((g) => g.id === guildId);
		if (!guild) return false;
		if (guild.owner) return true;
		const perms = BigInt(guild.permissions || guild.permissionsNew || "0");
		return (perms & 32n) === 32n;
	};

	router.get("/user/settings", authenticate, async (req, res) => {
		try {
			const db = useHooks.get("db");
			const user = await db.ZiUser.findOne({ userID: req.user.id });
			if (!user) return res.status(404).json({ error: "User not found" });
			res.json(user);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/user/settings", authenticate, async (req, res) => {
		try {
			const db = useHooks.get("db");
			const { lang, volume, color, genshinAutoClaim } = req.body;
			const updateData = {};
			if (lang !== undefined) updateData.lang = lang;
			if (volume !== undefined) updateData.volume = volume;
			if (color !== undefined) updateData.color = color;
			if (genshinAutoClaim !== undefined) updateData.genshinAutoClaim = genshinAutoClaim;
			await db.ZiUser.findOneAndUpdate({ userID: req.user.id }, { $set: updateData });
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.get("/user/guilds", authenticate, async (req, res) => {
		try {
			const db = useHooks.get("db");
			const user = await db.ZiUser.findOne({ userID: req.user.id });
			if (!user) return res.status(404).json({ error: "User not found" });
			const manageableGuilds = user.guilds.filter((g) => {
				if (g.owner) return true;
				const perms = BigInt(g.permissions || g.permissionsNew || "0");
				return (perms & 32n) === 32n;
			});
			res.json(manageableGuilds);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.get("/guild/:guildId", authenticate, async (req, res) => {
		try {
			if (!(await checkGuildAccess(req.user.id, req.params.guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			let guildConfig = await db.ZiGuild.findOne({ guildId: req.params.guildId });
			if (!guildConfig) guildConfig = await db.ZiGuild.create({ guildId: req.params.guildId });
			res.json(guildConfig);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/guild/:guildId", authenticate, async (req, res) => {
		try {
			if (!(await checkGuildAccess(req.user.id, req.params.guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			await db.ZiGuild.findOneAndUpdate({ guildId: req.params.guildId }, { $set: req.body }, { upsert: true });
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.get("/guild/:guildId/autoresponder", authenticate, async (req, res) => {
		try {
			if (!(await checkGuildAccess(req.user.id, req.params.guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			const responders = await db.ZiAutoresponder.find({ guildId: req.params.guildId });
			res.json(responders);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/guild/:guildId/autoresponder", authenticate, async (req, res) => {
		try {
			const { guildId } = req.params;
			if (!(await checkGuildAccess(req.user.id, guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			const { trigger, response, id } = req.body;
			if (id) {
				await db.ZiAutoresponder.findByIdAndUpdate(id, { trigger, response });
			} else {
				await db.ZiAutoresponder.create({ guildId, trigger, response });
			}
			const autoRes = useHooks.get("responder");
			if (autoRes) {
				const refreshed = await db.ZiAutoresponder.find({ guildId });
				autoRes.set(
					guildId,
					refreshed.map((r) => ({ trigger: r.trigger, response: r.response })),
				);
			}
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.get("/guild/:guildId/welcome", authenticate, async (req, res) => {
		try {
			if (!(await checkGuildAccess(req.user.id, req.params.guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			const welcome = await db.ZiWelcome.findOne({ guildId: req.params.guildId });
			res.json(welcome || {});
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/guild/:guildId/welcome", authenticate, async (req, res) => {
		try {
			const { guildId } = req.params;
			if (!(await checkGuildAccess(req.user.id, guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			const { channel, content, Bchannel, Bcontent } = req.body;
			await db.ZiWelcome.findOneAndUpdate({ guildId }, { $set: { channel, content, Bchannel, Bcontent } }, { upsert: true });
			const WelcomeCache = useHooks.get("welcome");
			if (WelcomeCache) {
				WelcomeCache.set(guildId, [{ channel, content, Bchannel, Bcontent }]);
			}
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});
	server.use("/", router);
	return;
};
