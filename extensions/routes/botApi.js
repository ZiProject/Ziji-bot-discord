const express = require("express");
const router = express.Router();

const { useHooks } = require("zihooks");

// Middleware to get DB instance
const getDB = () => {
	try {
		return useHooks.get("db");
	} catch (error) {
		console.error("[Bot API] Failed to get DB:", error);
		return null;
	}
};

// ============ USER ENDPOINTS ============

/**
 * GET /bot/users/:userId/guilds
 * Get all Discord servers/guilds that a user owns or has admin access to
 */
router.get("/users/:userId/guilds", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { userId } = req.params;

		const user = await db.ZiUser.findOne({ userID: userId }); // userID matches schema

		if (!user || !user.guilds) {
			return res.json({
				success: true,
				data: [],
			});
		}

		return res.json({
			success: true,
			data: user.guilds || [],
		});
	} catch (error) {
		console.error("[Bot API] Error fetching user guilds:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /bot/users/:userId/session
 * Save user Discord session with access token
 */
router.post("/users/:userId/session", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { userId } = req.params;
		const { discordAccessToken, userInfo } = req.body;

		if (!discordAccessToken) {
			return res.status(400).json({
				success: false,
				error: "discordAccessToken is required",
			});
		}

		const result = await db.ZiUser.updateOne(
			{ userID: userId }, // userID matches schema
			{
				$set: {
					userID: userId,
					discordAccessToken,
					userInfo: userInfo || {},
					updatedAt: new Date(),
				},
			},
			{ upsert: true },
		);

		return res.json({
			success: true,
			data: {
				userId,
				saved: result.acknowledged,
			},
		});
	} catch (error) {
		console.error("[Bot API] Error saving user session:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /bot/users/:userId/guilds
 * Save user's guilds list
 */
router.post("/users/:userId/guilds", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { userId } = req.params;
		const { guilds } = req.body;

		if (!Array.isArray(guilds)) {
			return res.status(400).json({
				success: false,
				error: "guilds must be an array",
			});
		}

		const processedGuilds = guilds.map((g) => ({
			id: g.id,
			name: g.name,
			icon: g.icon,
			owner: g.owner,
			permissions: g.permissions,
			permissionsNew: g.permissions_new,
		}));

		const result = await db.ZiUser.updateOne(
			{ userID: userId }, // userID matches schema
			{
				$set: {
					userID: userId,
					guilds: processedGuilds,
					updatedAt: new Date(),
				},
			},
			{ upsert: true },
		);

		return res.json({
			success: true,
			data: {
				userId,
				guildCount: guilds.length,
			},
		});
	} catch (error) {
		console.error("[Bot API] Error saving user guilds:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /bot/users/:userId/servers/:serverId/admin
 * Check if user has admin access to a server
 */
router.get("/users/:userId/servers/:serverId/admin", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { userId, serverId } = req.params;

		const user = await db.ZiUser.findOne({ userID: userId }); // userID matches schema

		if (!user || !user.guilds) {
			return res.json({
				success: true,
				data: {
					isAdmin: false,
					userId,
					serverId,
				},
			});
		}

		const serverGuild = user.guilds.find((g) => g.id === serverId);
		const isAdmin = serverGuild && serverGuild.owner === true;

		return res.json({
			success: true,
			data: {
				isAdmin,
				userId,
				serverId,
				guildName: serverGuild?.name,
			},
		});
	} catch (error) {
		console.error("[Bot API] Error checking admin status:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// ============ SERVER/GUILD ENDPOINTS ============

/**
 * GET /bot/servers/:serverId/config
 * Get the bot configuration for a server
 */
router.get("/servers/:serverId/config", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { serverId } = req.params;

		const config = await db.ZiGuild.findOne({ guildId: serverId });

		const defaultConfig = {
			serverId,
			prefix: "!",
			language: "en",
			modRole: null,
			logChannel: null,
			autorole: false,
			autoroleIds: [],
			customCommands: [],
		};

		return res.json({
			success: true,
			data: config || defaultConfig,
		});
	} catch (error) {
		console.error("[Bot API] Error fetching server config:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /bot/servers/:serverId/config
 * Update the bot configuration for a server
 */
router.post("/servers/:serverId/config", async (req, res) => {
	try {
		const db = getDB();
		if (!db) {
			return res.status(500).json({
				success: false,
				error: "Database not available",
			});
		}

		const { serverId } = req.params;
		const config = req.body;

		if (!config || typeof config !== "object") {
			return res.status(400).json({
				success: false,
				error: "Invalid config object",
			});
		}

		await db.ZiGuild.updateOne(
			{ guildId: serverId },
			{
				$set: {
					guildId: serverId,
					...config,
					updatedAt: new Date(),
				},
			},
			{ upsert: true },
		);

		// TODO: Broadcast config change to bot for real-time reload
		// const wss = useHooks.get('wss');
		// if (wss) wss.broadcast('config:updated', { serverId, config });

		return res.json({
			success: true,
			message: "Config updated successfully",
			data: {
				serverId,
				updatedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("[Bot API] Error updating server config:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /bot/servers/:serverId/info
 * Get basic information about a server from the Discord client cache
 */
router.get("/servers/:serverId/info", async (req, res) => {
	try {
		const { serverId } = req.params;
		const client = useHooks.get("client");

		if (!client) {
			return res.status(500).json({
				success: false,
				error: "Bot client not available",
			});
		}

		const guild = client.guilds.cache.get(serverId);

		if (!guild) {
			return res.status(404).json({
				success: false,
				error: "Server not found",
			});
		}

		return res.json({
			success: true,
			data: {
				id: guild.id,
				name: guild.name,
				icon: guild.icon,
				memberCount: guild.memberCount,
				owner: guild.ownerId,
			},
		});
	} catch (error) {
		console.error("[Bot API] Error fetching server info:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /bot/api/health
 * Health check endpoint
 */
router.get("/api/health", (req, res) => {
	return res.json({
		success: true,
		message: "Bot API is running",
	});
});

/**
 * USAGE in your bot server's main file (e.g., index.js):
 *
 * const apiRoutes = require('./routes/api');
 * app.use('/bot', apiRoutes);
 *
 * Now all routes will be available at:
 * - GET  /bot/users/:userId/guilds
 * - POST /bot/users/:userId/session
 * - POST /bot/users/:userId/guilds
 * - GET  /bot/users/:userId/servers/:serverId/admin
 * - GET  /bot/servers/:serverId/config
 * - POST /bot/servers/:serverId/config
 * - GET  /bot/servers/:serverId/info
 * - GET  /bot/api/health
 */

module.exports.data = {
	name: "APIRoutes",
	description: "Bot web control",
	version: "2.0.0",
	enable: true,
	priority: 9,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/bot", router);
};
