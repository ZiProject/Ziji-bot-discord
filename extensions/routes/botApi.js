const express = require("express");
const router = express.Router();
const axios = require("axios");
const path = require("path");
const fs = require("fs");
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
	const transcriptDir = path.join(__dirname, "../../transcripts");
	router.get(["/transcripts", "/transcripts/"], (req, res) => {
		return res.status(403).send("<h1>❌ 403 Forbidden</h1><p>Bạn không có quyền truy cập vào thư mục này.</p>");
	});
	router.use("/transcripts", express.static(transcriptDir));
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

			const token = jwt.sign({ id: userData.id, username: userData.username, avatar: userData.avatar }, process.env.JWT_SECRET, {
				expiresIn: "7d",
			});
			const dashboardUrl = process.env.DASHBOARD_URL?.trim();
			return res.send(`
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Xác thực thành công - Authorization Successful</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">

                    <style>
                        body { font-family: 'Google Sans', sans-serif; }
                        @keyframes pulse-ring {
                            0% { transform: scale(0.95); opacity: 0.8; }
                            50% { transform: scale(1.1); opacity: 0.4; }
                            100% { transform: scale(0.95); opacity: 0.8; }
                        }
                        .pulse-animation { animation: pulse-ring 2.5s infinite ease-in-out; }
                    </style>
                </head>
                <body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">

                    <!-- Background Decorative Elements -->
                    <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Main Container Card -->
                    <main class="relative z-10 w-full max-w-lg bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/50 text-center">
                        
                        <!-- Icon Success Badge -->
                        <div class="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                            <div class="absolute inset-0 bg-emerald-500/20 rounded-full pulse-animation"></div>
                            <div class="relative z-10 w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <i class="fa-solid fa-check text-slate-950 text-3xl font-bold"></i>
                            </div>
                        </div>

                        <!-- Title & Subtitle -->
                        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                            Xác thực thành công!
                        </h1>
                        <p class="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-4">
                            Authorization Successful
                        </p>
                        
                        <p class="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                            Nếu ứng dụng không tự mở, vui lòng sao chép mã token dưới đây và dán vào ứng dụng của bạn.
                        </p>

                        <!-- Token Box Section -->
                        <div class="text-left mb-6">
                            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Authorization Token</span>
                                <span class="text-emerald-400 text-[10px] font-normal lowercase flex items-center gap-1">
                                    <i class="fa-solid fa-shield-halved"></i> Bearer Token
                                </span>
                            </label>
                            <div class="relative group">
                                <textarea 
                                    id="token-input" 
                                    readonly 
                                    rows="3" 
                                    class="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-3.5 pr-12 text-xs sm:text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 resize-none selection:bg-indigo-500 selection:text-white transition"
                                >${token}</textarea>
                                
                                <button 
                                    id="copy-btn" 
                                    title="Sao chép Token"
                                    class="absolute right-3 top-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-600/50 transition duration-150 flex items-center justify-center"
                                >
                                    <i id="copy-icon" class="fa-regular fa-copy text-sm"></i>
                                </button>
                            </div>
                            
                            <!-- Notification Toast Message -->
                            <div id="toast" class="opacity-0 transition-opacity duration-300 mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1.5 justify-end">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>Đã sao chép token vào bộ nhớ tạm!</span>
                            </div>
                        </div>

                        <!-- Footer / Instructions -->
                        <div class="border-t border-slate-700/50 pt-4 text-xs text-slate-500 flex items-center justify-between">
                            <span class="flex items-center gap-1">
                                <i class="fa-regular fa-circle-question"></i> Bạn có thể đóng cửa sổ này.
                            </span>
                            <span class="font-mono text-[10px] text-slate-600">v1.0.0</span>
                        </div>
                    </main>

                    <script>
                        const tokenInput = document.getElementById('token-input');
                        const copyBtn = document.getElementById('copy-btn');
                        const copyIcon = document.getElementById('copy-icon');
                        const toast = document.getElementById('toast');
						const dashboardUrl = ${JSON.stringify(dashboardUrl || null)};
						const token = ${JSON.stringify(token)};

						if (typeof dashboardUrl === 'string' && dashboardUrl.trim()) {
							let seconds = 1;
							const timer = setInterval(() => {
								seconds--;
								if (seconds <= 0) {
									clearInterval(timer);
									window.location.href = \`\${dashboardUrl}/#/login-success?token=\${token}\`;
								}
							}, 1000);
						}
                        copyBtn.addEventListener('click', () => {
                            tokenInput.select();
                            try {
                                document.execCommand('copy');
                            } catch (err) {
                                navigator.clipboard.writeText(tokenInput.value);
                            }

                            copyIcon.className = 'fa-solid fa-check text-emerald-400';
                            toast.classList.remove('opacity-0');

                            setTimeout(() => {
                                copyIcon.className = 'fa-regular fa-copy';
                                toast.classList.add('opacity-0');
                            }, 2500);
                        });
                    </script>
                </body>
                </html>
            `);
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
			const { trigger, response, options, id } = req.body;
			if (id) {
				await db.ZiAutoresponder.findByIdAndUpdate(id, { trigger, response, options });
			} else {
				const existing = await db.ZiAutoresponder.find({ guildId });
				const isExisted = existing.some((ar) => ar.trigger.toLowerCase() === trigger.toLowerCase());
				if (isExisted) {
					return res.status(400).json({ error: `Autoresponder với trigger "${trigger}" đã tồn tại.` });
				}
				await db.ZiAutoresponder.create({
					guildId,
					trigger,
					response,
					options: options || { matchMode: "exactly" },
				});
			}
			const autoRes = useHooks.get("responder");
			if (autoRes) {
				const refreshed = await db.ZiAutoresponder.find({ guildId });
				autoRes.set(
					guildId,
					refreshed.map((r) => ({ trigger: r.trigger, response: r.response, matchMode: r.options?.matchMode || "exactly" })),
				);
			}
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.delete("/guild/:guildId/autoresponder/:id", authenticate, async (req, res) => {
		try {
			const { guildId, id } = req.params;
			if (!(await checkGuildAccess(req.user.id, guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			await db.ZiAutoresponder.findByIdAndDelete(id);
			const autoRes = useHooks.get("responder");
			if (autoRes) {
				const refreshed = await db.ZiAutoresponder.find({ guildId });
				autoRes.set(
					guildId,
					refreshed.map((r) => ({ trigger: r.trigger, response: r.response, matchMode: r.options?.matchMode || "exactly" })),
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

	router.get("/guild/:guildId/confess", authenticate, async (req, res) => {
		try {
			if (!(await checkGuildAccess(req.user.id, req.params.guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			let confess = await db.ZiConfess.findOne({ guildId: req.params.guildId });
			if (!confess) confess = await db.ZiConfess.create({ guildId: req.params.guildId });
			res.json(confess);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/guild/:guildId/confess", authenticate, async (req, res) => {
		try {
			const { guildId } = req.params;
			if (!(await checkGuildAccess(req.user.id, guildId))) return res.status(403).json({ error: "Access denied" });
			const db = useHooks.get("db");
			await db.ZiConfess.findOneAndUpdate({ guildId }, { $set: req.body }, { upsert: true });
			res.json({ success: true });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	// --- OWNER CUSTOM WORDS MANAGEMENT API ---

	const authenticateOwner = (req, res, next) => {
		const authHeader = req.headers.authorization;
		if (!authHeader) return res.status(401).send("No token provided");
		const token = authHeader.split(" ")[1];
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			req.user = decoded;
			const currentConfig = useHooks.get("config");
			if (!currentConfig || !currentConfig.OwnerID || !currentConfig.OwnerID.includes(decoded.id)) {
				return res.status(403).json({ error: "Access denied: Owner only" });
			}
			next();
		} catch (error) {
			res.status(401).send("Invalid token");
		}
	};

	router.get("/admin/words", authenticateOwner, async (req, res) => {
		try {
			const db = useHooks.get("db");
			if (!db || !db.ZiData) return res.status(500).json({ error: "Database not available" });
			const words = await db.ZiData.find({ type: "wordgame_words" }).lean();
			res.json(words);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.post("/admin/words", authenticateOwner, async (req, res) => {
		try {
			const db = useHooks.get("db");
			if (!db || !db.ZiData) return res.status(500).json({ error: "Database not available" });

			const { words } = req.body;
			if (!words || typeof words !== "string") {
				return res.status(400).json({ error: "Missing or invalid words field" });
			}

			const rawWords = words
				.split(/[\n,;]+/)
				.map((w) => w.trim().toLowerCase())
				.filter(Boolean);
			const { countSyllables, isValidWord } = require("../../utility/wordGameUtils");

			const added = [];
			const existing = [];
			const invalid = [];

			const customWords = useHooks.get("customWords") || new Set();

			for (const word of rawWords) {
				if (countSyllables(word) !== 2) {
					invalid.push(word);
					continue;
				}

				if (isValidWord(word)) {
					existing.push(word);
					continue;
				}

				await db.ZiData.create({
					type: "wordgame_words",
					key: word,
					value: JSON.stringify({ addedBy: req.user.id, addedAt: new Date() }),
				});

				customWords.add(word);
				added.push(word);
			}

			useHooks.set("customWords", customWords);
			res.json({ success: true, added, existing, invalid });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	router.delete("/admin/words/:word", authenticateOwner, async (req, res) => {
		try {
			const db = useHooks.get("db");
			if (!db || !db.ZiData) return res.status(500).json({ error: "Database not available" });

			const word = req.params.word.trim().toLowerCase();
			const result = await db.ZiData.deleteOne({ type: "wordgame_words", key: word });

			const customWords = useHooks.get("customWords");
			if (customWords) {
				customWords.delete(word);
			}

			res.json({ success: result.deletedCount > 0 });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});

	server.use("/", router);
	return;
};
