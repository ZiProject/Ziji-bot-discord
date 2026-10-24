const fs = require("node:fs");
const path = require("node:path");
const { Hono } = require("hono");
const { getConnInfo } = require("@hono/node-server/conninfo");
const { useHooks } = require("zihooks");
const { ActivityType } = require("discord.js");
const envSetup = require("../../utils/envSetup");
const { renderEnvSection, renderEnvScript, escapeHtml } = require("../../utils/envSetupUi");

module.exports.data = {
	name: "configSetupRoute",
	description: "Web and API interface for localhost bot configuration setup",
	version: "1.0.0",
	enable: !!process.argv.includes("--config"),
	priority: 8,
};

const getRootDir = () => path.resolve(__dirname, "../../");
const getConfigPath = () => path.join(getRootDir(), "config.js");
const getEnvPath = () => path.join(getRootDir(), ".env");

const getDefaultConfigPath = () => {
	const rootDir = getRootDir();
	const candidates = [path.join(rootDir, "startup", "defaultconfig.js"), path.join(rootDir, "config.js.example")];
	return candidates.find((cand) => fs.existsSync(cand)) || candidates[0];
};

const isTestEnv =
	process.env.NODE_ENV === "test" ||
	process.execArgv.includes("--test") ||
	process.argv.some((arg) => typeof arg === "string" && arg.includes("test"));

const getClientIp = (context) => {
	try {
		const info = getConnInfo(context);
		if (info?.remote?.address) return info.remote.address;
	} catch {}

	const incoming = context.env?.incoming;
	if (incoming?.socket?.remoteAddress) return incoming.socket.remoteAddress;

	if (context.req.raw?.socket?.remoteAddress) return context.req.raw.socket.remoteAddress;

	if (isTestEnv) {
		const testIp = context.get("remoteAddress") || context.req.header("x-test-ip") || context.req.header("x-forwarded-for");
		if (testIp) return testIp;
	}

	return null;
};

const isLocalhostAddress = (address) => {
	if (!address) return false;
	const clean = address
		.replace(/^::ffff:/, "")
		.trim()
		.toLowerCase();
	return clean === "127.0.0.1" || clean === "::1" || clean === "localhost" || clean.startsWith("127.");
};

const isLocalhostRequest = (context) => {
	const clientIp = getClientIp(context);
	if (!isLocalhostAddress(clientIp)) return false;

	const hostHeader = context.req.header("host") || "";
	const hostname = hostHeader.split(":")[0].toLowerCase();
	if (!isTestEnv && hostname) {
		const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
		if (!isLocalHost) return false;
	}

	return true;
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Names of every command, for the "Disabled commands" picker.
 * In `--config` mode loadModules() never runs, so the `commands` hook is empty: read the files in /commands instead.
 * Names are read statically (no command code is executed); require() is only a fallback.
 */
const readCommandNamesFromDisk = () => {
	const names = new Set();
	const walk = (dir) => {
		let entries = [];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(fullPath);
			else if (entry.isFile() && entry.name.endsWith(".js")) {
				let source = "";
				try {
					source = fs.readFileSync(fullPath, "utf8");
				} catch {
					continue;
				}
				const match = source.match(/(?:module\.exports\.data|data:?)\s*=?\s*\{[\s\S]*?\bname\s*:\s*(["'`])([^"'`$]+)\1/);
				if (match) {
					names.add(match[2]);
					continue;
				}
				try {
					const name = require(fullPath)?.data?.name;
					if (typeof name === "string" && name) names.add(name);
				} catch {}
			}
		}
	};
	walk(path.join(getRootDir(), "commands"));
	return [...names];
};

const getCommandNames = (commands, extraNames = []) => {
	const loaded =
		commands && typeof commands.values === "function" ? [...commands.values()]
		: Array.isArray(commands) ? commands
		: [];
	const names = new Set(loaded.map((command) => command?.data?.name).filter(Boolean));
	if (!names.size) for (const name of readCommandNamesFromDisk()) names.add(name);
	// Keep names that are already disabled in config.js so saving the form never drops them silently.
	for (const name of extraNames) if (typeof name === "string" && name) names.add(name);
	return [...names].sort((a, b) => a.localeCompare(b));
};

const parseFormNumber = (value, fallback) => {
	if (value === undefined || value === "") return fallback;
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
};

const deepMerge = (target, source) => {
	for (const key of Object.keys(source)) {
		if (
			source[key] !== null &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key]) &&
			target[key] !== null &&
			typeof target[key] === "object" &&
			!Array.isArray(target[key])
		) {
			deepMerge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
};

const serializeConfig = (configObj) => {
	return `/**
 * Ziji Bot Discord - Configuration
 * Auto-generated by Localhost Config Setup
 * Last updated: ${new Date().toISOString()}
 */

module.exports = ${JSON.stringify(configObj, null, "\t")};
`;
};

const parseDiscordActivityType = (typeStr) => {
	switch (String(typeStr).toUpperCase()) {
		case "STREAMING":
			return ActivityType.Streaming;
		case "LISTENING":
			return ActivityType.Listening;
		case "WATCHING":
			return ActivityType.Watching;
		case "COMPETING":
			return ActivityType.Competing;
		case "CUSTOM":
			return ActivityType.Custom;
		case "PLAYING":
		default:
			return ActivityType.Playing;
	}
};

const updateClientPresence = (client, botConfig) => {
	if (!client?.user || !client.isReady?.()) return;
	const status = botConfig?.Status || "online";
	const activityName = botConfig?.ActivityName;
	const activityType = parseDiscordActivityType(botConfig?.ActivityType || "PLAYING");

	try {
		client.user.setPresence({
			status,
			activities: activityName ? [{ name: activityName, type: activityType }] : [],
		});
	} catch (err) {
		console.warn("Could not update Discord client presence:", err.message);
	}
};
/**
 *
 * @param {import("discord.js").Client} client
 * @returns
 */
module.exports.execute = (client) => {
	const server = useHooks.get("server");
	if (!server) return;

	const router = new Hono();

	// Middleware: Localhost only check (only for /config and /api/config paths)
	const localhostOnly = async (context, next) => {
		if (!isLocalhostRequest(context)) {
			const isApi =
				context.req.path.startsWith("/api/") ||
				context.req.header("accept")?.includes("application/json") ||
				context.req.header("content-type")?.includes("application/json");

			if (isApi) {
				return context.json(
					{
						status: "FORBIDDEN",
						error: "Truy cập bị từ chối: Cấu hình chỉ được phép thiết lập trên localhost (127.0.0.1).",
						clientIp: getClientIp(context),
					},
					403,
				);
			}

			return context.html(
				`<!DOCTYPE html>
<html lang="vi">
<head>
	<meta charset="utf-8">
	<title>403 Forbidden - Chỉ cho phép trên Localhost</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<style>
		body { background: #0b0f19; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
		.card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(239, 68, 68, 0.3); backdrop-filter: blur(12px); border-radius: 16px; padding: 2.5rem; max-width: 500px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
		.icon { font-size: 3rem; margin-bottom: 1rem; color: #ef4444; }
		h1 { color: #f87171; margin: 0 0 0.5rem 0; font-size: 1.6rem; }
		p { color: #94a3b8; line-height: 1.6; margin: 0.5rem 0; }
		.badge { display: inline-block; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 14px; border-radius: 9999px; font-size: 0.85rem; font-family: monospace; margin-top: 1.5rem; }
	</style>
</head>
<body>
	<div class="card">
		<div class="icon">🚫</div>
		<h1>403 Forbidden</h1>
		<p>Trang thiết lập cấu hình bot chỉ cho phép truy cập từ máy chủ cục bộ (<strong>localhost / 127.0.0.1</strong>).</p>
		<p>Yêu cầu từ IP của bạn đã bị từ chối nhằm bảo vệ an toàn cho bot.</p>
		<div class="badge">Địa chỉ IP của bạn: ${getClientIp(context) || "Unknown"}</div>
	</div>
</body>
</html>`,
				403,
			);
		}

		await next();
	};

	router.use("/config", localhostOnly);
	router.use("/config/*", localhostOnly);
	router.use("/api/config", localhostOnly);
	router.use("/api/config/*", localhostOnly);

	// API: Get current config
	router.get("/api/config", (context) => {
		const currentConfig = useHooks.get("config") || {};
		return context.json({
			status: "OK",
			config: currentConfig,
		});
	});

	const MAX_ENV_FILE_SIZE = 256 * 1024;

	const readJsonBody = async (context) => {
		const cached = context.get("body");
		if (cached && typeof cached === "object") return cached;
		return context.req.json().catch(() => null);
	};

	const isClientLoggedIn = () => !!client?.user && (typeof client.isReady === "function" ? client.isReady() : true);

	const getBotInfo = () => {
		if (!isClientLoggedIn()) return null;
		const user = client.user;
		return { id: user.id, tag: user.tag || user.username || user.displayName || user.id };
	};

	const noStore = (context) => context.header("Cache-Control", "no-store");

	/** Returns the .env text, or null when the file does not exist yet. */
	const readEnvFile = async () => {
		try {
			return await fs.promises.readFile(getEnvPath(), "utf8");
		} catch (error) {
			if (error.code === "ENOENT") return null;
			throw error;
		}
	};

	const hasEnvChanges = (body) =>
		typeof body?.content === "string" ||
		Object.keys(body?.values || {}).length > 0 ||
		(Array.isArray(body?.remove) && body.remove.length > 0);

	/**
	 * Save either `{ values, remove }` (edited in place, comments are kept) or the legacy `{ content }`.
	 * Throws an error with `status = 400` when the input is invalid.
	 */
	const saveEnvChanges = async (body) => {
		let next;
		if (typeof body.content === "string") {
			if (body.content.length > MAX_ENV_FILE_SIZE) throw Object.assign(new Error(".env quá lớn."), { status: 400 });
			next = body.content;
		} else {
			let current = await readEnvFile();
			if (current === null) {
				const examplePath = path.join(getRootDir(), ".env.example");
				current = fs.existsSync(examplePath) ? await fs.promises.readFile(examplePath, "utf8") : "";
			}
			try {
				next = envSetup.applyEnvChanges(current, { values: body.values, remove: body.remove });
			} catch (error) {
				throw Object.assign(new Error(error.message), { status: 400 });
			}
		}
		await fs.promises.writeFile(getEnvPath(), next, { encoding: "utf8", mode: 0o600 });
		return envSetup.parseEnv(next);
	};

	// API: login state (no secrets)
	router.get("/api/config/status", (context) => {
		noStore(context);
		return context.json({ status: "OK", loggedIn: isClientLoggedIn(), bot: getBotInfo() });
	});

	// API: read .env (only requested by the page after the user chooses to reveal it)
	router.get("/api/config/env", async (context) => {
		noStore(context);
		try {
			const content = await readEnvFile();
			return context.json({ status: "OK", exists: content !== null, values: envSetup.parseEnv(content || "") });
		} catch (error) {
			return context.json({ status: "ERROR", error: `Không thể đọc .env: ${error.message}` }, 500);
		}
	});

	// API: save .env
	router.post("/api/config/env", async (context) => {
		noStore(context);
		const body = await readJsonBody(context);
		if (!body || typeof body !== "object") return context.json({ status: "ERROR", error: "Dữ liệu .env không hợp lệ." }, 400);
		try {
			const values = await saveEnvChanges(body);
			return context.json({ status: "OK", message: "Đã lưu .env. Khởi động lại bot để áp dụng.", values });
		} catch (error) {
			if (error.status === 400) return context.json({ status: "ERROR", error: error.message }, 400);
			return context.json({ status: "ERROR", error: `Không thể lưu .env: ${error.message}` }, 500);
		}
	});

	// API: test ONE value (token, MONGO, API key...) without saving it
	router.post("/api/config/env/test", async (context) => {
		noStore(context);
		const body = await readJsonBody(context);
		if (!body || typeof body.key !== "string" || typeof body.value !== "string") {
			return context.json({ status: "ERROR", error: "Thiếu key hoặc value cần test." }, 400);
		}
		if (!envSetup.KNOWN_KEYS.has(body.key)) {
			return context.json({ status: "ERROR", error: "Mục này không hỗ trợ test." }, 400);
		}
		const testContext = {};
		if (typeof body.context?.TOKEN === "string") testContext.TOKEN = body.context.TOKEN;
		try {
			const result = await envSetup.testEnvValue(body.key, body.value, { context: testContext, client });
			if (!result) return context.json({ status: "ERROR", error: "Mục này không hỗ trợ test." }, 400);
			return context.json({ status: "OK", result });
		} catch (error) {
			console.error(`Config setup: testing ${body.key} failed:`, error?.name || error);
			return context.json({ status: "ERROR", error: "Không thể kiểm tra giá trị này." }, 500);
		}
	});

	// API: save .env (when there are changes) then log the bot in with TOKEN
	let loginInFlight = false;
	router.post("/api/config/login", async (context) => {
		noStore(context);
		const body = await readJsonBody(context);
		if (!body || typeof body !== "object") return context.json({ status: "ERROR", error: "Dữ liệu không hợp lệ." }, 400);

		let values;
		try {
			if (hasEnvChanges(body)) values = await saveEnvChanges(body);
		} catch (error) {
			if (error.status === 400) return context.json({ status: "ERROR", error: error.message }, 400);
			return context.json({ status: "ERROR", error: `Không thể lưu .env: ${error.message}` }, 500);
		}

		try {
			const envContent = await readEnvFile();
			const token = envSetup.cleanDiscordToken(envSetup.parseEnv(envContent || "").TOKEN);
			const saved = values !== undefined;
			if (!token) {
				return context.json(
					{ status: "ERROR", error: "Không tìm thấy TOKEN trong .env. Hãy nhập bot token rồi thử lại.", saved, values },
					400,
				);
			}

			// Check the token over REST first so the error message is precise and no gateway session is wasted.
			const check = await envSetup.testDiscordToken(token, { checkIntents: true });
			if (!check.ok) return context.json({ status: "ERROR", error: check.message, saved, values }, 401);

			if (isClientLoggedIn()) {
				if (client.user.id === check.bot.id) {
					return context.json({ status: "OK", message: "Bot đã đăng nhập sẵn.", bot: getBotInfo(), values });
				}
				return context.json(
					{
						status: "ERROR",
						error: `Bot đang đăng nhập bằng tài khoản khác (${getBotInfo().tag}). TOKEN mới đã được lưu, hãy khởi động lại bot để dùng.`,
						saved,
						values,
					},
					409,
				);
			}
			if (typeof client?.login !== "function") {
				return context.json({ status: "ERROR", error: "Discord client không khả dụng.", saved, values }, 503);
			}
			if (loginInFlight) return context.json({ status: "ERROR", error: "Đang đăng nhập, vui lòng chờ.", saved, values }, 409);

			loginInFlight = true;
			try {
				await client.login(token);
			} finally {
				loginInFlight = false;
			}
			process.env.TOKEN = token;
			return context.json({
				status: "OK",
				message: `Đăng nhập thành công${client.user?.tag ? ` với bot ${client.user.tag}` : ""}.${check.level === "warn" ? ` ${check.message}` : ""}`,
				bot: getBotInfo() || { id: check.bot.id, tag: check.bot.tag },
				values,
			});
		} catch (error) {
			console.error("Discord client login failed from config setup:", error);
			return context.json(
				{ status: "ERROR", error: `Đăng nhập Discord thất bại: ${error.message}`, saved: values !== undefined, values },
				401,
			);
		}
	});

	router.get("/api/config/lookups", async (context) => {
		const query = (context.req.query("q") || "").trim().toLowerCase();
		const users = new Map(client?.users?.cache || []);
		for (const guild of client?.guilds?.cache?.values() || []) {
			for (const member of guild.members?.cache?.values() || []) {
				users.set(member.user.id, member.user);
			}
		}
		const guilds = client?.guilds?.cache || new Map();
		const matchingUsers = [...users.values()]
			.filter((user) => {
				const searchable = `${user.username} ${user.globalName || ""} ${user.id}`.toLowerCase();
				return !query || searchable.includes(query);
			})
			.slice(0, 20)
			.map((user) => ({ id: user.id, label: user.globalName || user.username }));

		if (/^\d{17,20}$/.test(query) && client?.users?.fetch && !matchingUsers.some((user) => user.id === query)) {
			let user;
			try {
				user = await client.users.fetch(query);
			} catch (error) {
				if (error.code !== 10013) {
					console.error("Could not look up Discord user:", error);
					return context.json({ status: "ERROR", error: "Không thể tra cứu user từ Discord." }, 502);
				}
			}
			if (user) matchingUsers.unshift({ id: user.id, label: user.globalName || user.username });
		}

		const matchingGuilds = [...guilds.values()]
			.filter((guild) => !query || `${guild.name} ${guild.id}`.toLowerCase().includes(query))
			.slice(0, 20)
			.map((guild) => ({ id: guild.id, label: guild.name }));
		const channels = new Map();
		for (const channel of client?.channels?.cache?.values() || []) {
			if (channel.isTextBased?.() && channel.isSendable?.()) channels.set(channel.id, channel);
		}
		for (const guild of client?.guilds?.cache?.values() || []) {
			for (const channel of guild.channels?.cache?.values() || []) {
				if (channel.isTextBased?.() && channel.isSendable?.()) channels.set(channel.id, channel);
			}
		}
		const matchingChannels = [...channels.values()]
			.filter(
				(channel) => !query || `${channel.name || ""} ${channel.guild?.name || ""} ${channel.id}`.toLowerCase().includes(query),
			)
			.slice(0, 20)
			.map((channel) => ({
				id: channel.id,
				label: `${channel.guild?.name ? `${channel.guild.name} / ` : ""}#${channel.name || channel.id}`,
			}));

		if (/^\d{17,20}$/.test(query) && client?.channels?.fetch && !channels.has(query)) {
			let channel;
			try {
				channel = await client.channels.fetch(query);
			} catch (error) {
				if (error.code !== 10003) {
					console.error("Could not look up Discord channel:", error);
					return context.json({ status: "ERROR", error: "Không thể tra cứu channel từ Discord." }, 502);
				}
			}
			if (channel?.isTextBased?.() && channel?.isSendable?.()) {
				matchingChannels.unshift({
					id: channel.id,
					label: `${channel.guild?.name ? `${channel.guild.name} / ` : ""}#${channel.name || channel.id}`,
				});
			}
		}

		return context.json({
			status: "OK",
			users: matchingUsers,
			guilds: matchingGuilds,
			channels: matchingChannels,
		});
	});

	// API: Update config
	router.post("/api/config", async (context) => {
		let body = context.get("body");
		if (!body || typeof body !== "object") {
			try {
				body = await context.req.json();
			} catch {
				return context.json({ status: "ERROR", error: "Dữ liệu JSON không hợp lệ." }, 400);
			}
		}

		// Validation
		if (body.prefix !== undefined) {
			if (typeof body.prefix !== "string" || body.prefix.trim().length === 0) {
				return context.json({ status: "ERROR", error: "Prefix không được để trống." }, 400);
			}
			body.prefix = body.prefix.trim();
		}

		if (body.defaultCooldownDuration !== undefined) {
			const cd = Number(body.defaultCooldownDuration);
			if (isNaN(cd) || cd < 0) {
				return context.json({ status: "ERROR", error: "defaultCooldownDuration phải là số không âm." }, 400);
			}
			body.defaultCooldownDuration = cd;
		}

		if (body.botConfig?.Status !== undefined) {
			const validStatuses = ["online", "idle", "dnd", "invisible"];
			if (!validStatuses.includes(body.botConfig.Status)) {
				return context.json({ status: "ERROR", error: "Trạng thái bot không hợp lệ." }, 400);
			}
		}

		const currentConfig = useHooks.get("config") || {};
		const merged = deepMerge(deepClone(currentConfig), body);
		delete merged.playerConfig;
		if (merged.PlayerConfig?.pauseOnEmpty === true) merged.PlayerConfig.leaveOnEmpty = false;

		const configPath = getConfigPath();
		try {
			const serialized = serializeConfig(merged);
			await fs.promises.writeFile(configPath, serialized, "utf8");

			// Clear cache
			try {
				delete require.cache[require.resolve(configPath)];
			} catch {}

			// Update in hooks
			useHooks.set("config", merged);

			// Update discord client presence if available
			if (body.botConfig) {
				updateClientPresence(client, merged.botConfig);
			}

			return context.json({
				status: "OK",
				message: "Cấu hình bot đã được lưu thành công vào config.js!",
				config: merged,
			});
		} catch (err) {
			console.error("Lỗi khi ghi config.js:", err);
			return context.json({ status: "ERROR", error: `Không thể lưu config.js: ${err.message}` }, 500);
		}
	});

	// API: Reset config to default
	router.post("/api/config/reset", async (context) => {
		const defaultPath = getDefaultConfigPath();
		const configPath = getConfigPath();

		if (!fs.existsSync(defaultPath)) {
			return context.json({ status: "ERROR", error: "Không tìm thấy file defaultconfig.js để khôi phục." }, 404);
		}

		try {
			await fs.promises.copyFile(defaultPath, configPath);
			try {
				delete require.cache[require.resolve(configPath)];
			} catch {}

			const freshConfig = require(configPath);
			useHooks.set("config", freshConfig);

			if (freshConfig.botConfig) {
				updateClientPresence(client, freshConfig.botConfig);
			}

			return context.json({
				status: "OK",
				message: "Đã khôi phục cấu hình mặc định thành công!",
				config: freshConfig,
			});
		} catch (err) {
			console.error("Lỗi khi khôi phục config:", err);
			return context.json({ status: "ERROR", error: `Không thể khôi phục: ${err.message}` }, 500);
		}
	});

	// Web UI HTML Form POST fallback
	const handleFormPost = async (context) => {
		const contentType = context.req.header("content-type") || "";
		let updates = {};

		if (contentType.includes("application/x-www-form-urlencoded")) {
			const formData = await context.req.parseBody();
			updates = {
				prefix: formData.prefix,
				deploy: formData.deploy === "true" || formData.deploy === "on",
				defaultCooldownDuration: parseFormNumber(formData.defaultCooldownDuration, 5000),
				defaultColor: formData.defaultColor || "Random",
				Moptions: formData.Moptions || "--",
				ImageSearch: formData.ImageSearch === "true" || formData.ImageSearch === "on",
				DefaultLang: formData.defaultLang || "vi",
				OwnerID: String(formData.ownerIds || "")
					.split(/[,\r\n]/)
					.map((value) => value.trim())
					.filter(Boolean),
				DevGuild: String(formData.devGuildIds || "")
					.split(/[,\r\n]/)
					.map((value) => value.trim())
					.filter(Boolean),
				disabledCommands: String(formData.disabledCommands || "")
					.split(/[,\r\n]/)
					.map((value) => value.trim())
					.filter(Boolean),
				botConfig: {
					Status: formData.botStatus,
					ActivityType: formData.activityType,
					ActivityName: formData.activityName,
					Banner: formData.banner,
					webBackground: formData.webBackground,
					SupportServer: formData.supportServer,
					InviteBot: formData.inviteBot,
					ErrorLog: formData.errorLog,
					FeedBack: formData.feedback,
				},
				webAppConfig: {
					dashboardUrl: formData.dashboardUrl,
					musicControllerUrl: formData.musicControllerUrl,
					statusUrl: formData.statusUrl,
				},
				PlayerConfig: {
					selfDeaf: formData.playerSelfDeaf === "true" || formData.playerSelfDeaf === "on",
					volume: formData.playerVolumeMode === "auto" ? "auto" : parseFormNumber(formData.playerVolume, 50),
					leaveOnEmpty: false,
					leaveOnEnd: formData.playerLeaveOnEnd === "true" || formData.playerLeaveOnEnd === "on",
					leaveOnEndCooldown: parseFormNumber(formData.leaveOnEndCooldown, 50000),
					changeStatus: formData.playerChangeStatus === "true" || formData.playerChangeStatus === "on",
					pauseOnEmpty: formData.pauseOnEmpty === "true" || formData.pauseOnEmpty === "on",
				},
				DevConfig: {
					DJS_DEBUG: formData.djsDebug === "true" || formData.djsDebug === "on",
					Player_DEBUG: formData.playerDebug === "true" || formData.playerDebug === "on",
					debugLevel: formData.debugLevel || "info",
					voiceExt_DEBUG: formData.voiceExtDebug === "true" || formData.voiceExtDebug === "on",
					prisma_DEBUG: formData.prismaDebug === "true" || formData.prismaDebug === "on",
					loaderDebug: formData.loaderDebug === "true" || formData.loaderDebug === "on",
					Giveaway: formData.giveawayEnabled === "true" || formData.giveawayEnabled === "on",
					AutoResponder: formData.autoResponderEnabled === "true" || formData.autoResponderEnabled === "on",
					ticket: formData.ticketEnabled === "true" || formData.ticketEnabled === "on",
					welcomer: formData.welcomerEnabled === "true" || formData.welcomerEnabled === "on",
					ai: formData.aiEnabled === "true" || formData.aiEnabled === "on",
					aiAutoPlay: formData.aiAutoPlayEnabled === "true" || formData.aiAutoPlayEnabled === "on",
					GuildCommand: formData.guildCommandEnabled === "true" || formData.guildCommandEnabled === "on",
					logger: formData.loggerLevel,
				},
			};
		} else {
			updates = context.get("body") || (await context.req.json().catch(() => ({})));
		}

		const currentConfig = useHooks.get("config") || {};
		const merged = deepMerge(deepClone(currentConfig), updates);
		delete merged.playerConfig;
		if (merged.PlayerConfig?.pauseOnEmpty === true) merged.PlayerConfig.leaveOnEmpty = false;
		const configPath = getConfigPath();

		try {
			await fs.promises.writeFile(configPath, serializeConfig(merged), "utf8");
			try {
				delete require.cache[require.resolve(configPath)];
			} catch {}
			useHooks.set("config", merged);
			if (merged.botConfig) updateClientPresence(client, merged.botConfig);
		} catch (err) {
			console.error("Lỗi khi ghi config:", err);
		}

		return context.redirect("/config?saved=1");
	};

	router.post("/config", handleFormPost);
	router.post("/config/*", handleFormPost);

	// Web UI: Glassmorphism Anime Theme Setup Page
	const renderSetupPage = (context) => {
		const config = { ...(useHooks.get("config") || {}) };
		delete config.playerConfig;
		const botConfig = config.botConfig || {};
		const defaultPlayerConfig = config.PlayerConfig || {};
		const webAppConfig = config.webAppConfig || {};
		const devConfig = config.DevConfig || {};
		const commands = useHooks.get("commands") || [];
		const langDir = path.join(getRootDir(), "lang");
		const languages = fs
			.readdirSync(langDir, { withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
			.map((entry) => {
				const code = path.basename(entry.name, ".js");
				const language = require(path.join(langDir, entry.name));
				return {
					code,
					name: language.until?.name || language.name || code,
				};
			})
			.sort((a, b) => a.code.localeCompare(b.code));
		const defaultLang =
			config.DefaultLang || languages.find((language) => language.code === "vi")?.code || languages[0]?.code || "";
		const languageOptions = languages
			.map(
				(language) =>
					`<option value="${language.code}" ${defaultLang === language.code ? "selected" : ""}>${language.name} (${language.code})</option>`,
			)
			.join("");
		const disabledCommands = new Set(Array.isArray(config.disabledCommands) ? config.disabledCommands : []);
		const commandNames = getCommandNames(commands, [...disabledCommands]);
		const commandsData = escapeHtml(JSON.stringify(commandNames));
		const disabledData = escapeHtml(JSON.stringify([...disabledCommands]));
		const clientUser = client?.user || { displayName: "Ziji Bot", id: "N/A" };
		const avatarUrl =
			clientUser.displayAvatarURL ?
				clientUser.displayAvatarURL({ size: 256 })
			:	"https://media.discordapp.net/attachments/1064851388221358153/1209448467077005332/image.png";

		const bgUrl =
			botConfig.webBackground ||
			botConfig.Banner ||
			"https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1920&auto=format&fit=crop";

		const html = `<!DOCTYPE html>
<html lang="vi">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cài đặt cấu hình - ${clientUser.displayName || "Ziji Bot"}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
	<script src="https://cdn.tailwindcss.com"></script>
	<style>
		:root {
			--bg-image: url('${bgUrl}');
		}
		body {
			font-family: 'Plus Jakarta Sans', sans-serif;
			background-color: #0b0f19;
			background-image: radial-gradient(circle at 10% 20%, rgba(88, 101, 242, 0.15) 0%, transparent 40%),
							radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 40%),
							var(--bg-image);
			background-size: cover;
			background-position: center;
			background-attachment: fixed;
			color: #f8fafc;
			min-height: 100vh;
		}
		.glass-panel {
			background: rgba(15, 23, 42, 0.75);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border: 1px solid rgba(255, 255, 255, 0.08);
			box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
		}
		.glass-input {
			background: rgba(30, 41, 59, 0.6);
			border: 1px solid rgba(255, 255, 255, 0.1);
			color: #f1f5f9;
			transition: all 0.2s ease;
		}
		.glass-input:focus {
			background: rgba(30, 41, 59, 0.9);
			border-color: #6366f1;
			box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
			outline: none;
		}
		.tab-btn.active {
			background: #6366f1;
			color: #ffffff;
			box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
		}
		.tab-btn:not(.active):hover {
			background: rgba(255, 255, 255, 0.05);
			color: #e2e8f0;
		}
		.switch-toggle {
			width: 44px;
			height: 24px;
		}
		.toast {
			position: fixed;
			bottom: 2rem;
			right: 2rem;
			z-index: 100;
			max-width: calc(100vw - 4rem);
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transform: translateY(150%);
			transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, visibility 0s linear 0.3s;
		}
		.toast.show {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
			transform: translateY(0);
			transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, visibility 0s;
		}
		pre, code, textarea.font-mono {
			font-family: 'JetBrains Mono', monospace;
		}
	</style>
</head>
<body class="p-4 md:p-8">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<header class="glass-panel rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<img src="${avatarUrl}" alt="Bot Avatar" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/50 shadow-lg">
				<div>
					<div class="flex items-center gap-2">
						<h1 class="text-2xl font-bold tracking-tight">${clientUser.displayName || "Ziji Bot"}</h1>
						<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
							Localhost
						</span>
					</div>
					<p class="text-sm text-slate-400 mt-1">Trang quản trị & thiết lập cấu hình bot cục bộ</p>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<a href="/" class="px-4 py-2 rounded-xl text-sm font-medium glass-input hover:bg-slate-700/60 transition flex items-center gap-2">
					<i class="fa-solid fa-arrow-left"></i> Dashboard
				</a>
				<button type="button" onclick="resetToDefault()" class="px-4 py-2 rounded-xl text-sm font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition flex items-center gap-2">
					<i class="fa-solid fa-rotate-left"></i> Khôi phục mặc định
				</button>
				<button type="button" onclick="saveConfiguration()" class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-2">
					<i class="fa-solid fa-floppy-disk"></i> Lưu cấu hình
				</button>
			</div>
		</header>
		${renderEnvSection({ loggedIn: isClientLoggedIn(), botName: getBotInfo()?.tag || "" })}

		<!-- Main Container -->
		<div class="glass-panel rounded-2xl p-6 md:p-8">
			<!-- Tabs Nav -->
			<div class="flex flex-wrap gap-2 mb-8 border-b border-slate-700/60 pb-4">
				<button onclick="switchTab('basic')" id="tab-basic-btn" class="tab-btn active px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
					<i class="fa-solid fa-sliders"></i> Cài đặt chung
				</button>
				<button onclick="switchTab('presence')" id="tab-presence-btn" class="tab-btn px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 text-slate-300">
					<i class="fa-solid fa-robot"></i> Trạng thái & Hoạt động
				</button>
				<button onclick="switchTab('player')" id="tab-player-btn" class="tab-btn px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 text-slate-300">
					<i class="fa-solid fa-music"></i> Trình phát nhạc
				</button>
				<button onclick="switchTab('dev')" id="tab-dev-btn" class="tab-btn px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 text-slate-300">
					<i class="fa-solid fa-code"></i> Nâng cao & JSON
				</button>
			</div>

			<!-- Tab 1: Cài đặt chung -->
			<div id="tab-basic" class="tab-content space-y-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-terminal text-indigo-400 mr-1.5"></i> Prefix lệnh mặc định
						</label>
						<input type="text" id="prefix" value="${config.prefix || "z!"}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="Ví dụ: z!, !, ?">
						<p class="text-xs text-slate-400 mt-1.5">Tiền tố dùng cho các tin nhắn lệnh thông thường.</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-stopwatch text-indigo-400 mr-1.5"></i> Cooldown mặc định (mili giây)
						</label>
						<input type="number" id="defaultCooldownDuration" value="${config.defaultCooldownDuration ?? 5000}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="5000">
						<p class="text-xs text-slate-400 mt-1.5">Thời gian giãn cách giữa 2 lần dùng lệnh (5000 ms = 5 giây).</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-palette text-indigo-400 mr-1.5"></i> Màu Embed mặc định
						</label>
						<div class="flex gap-2">
							<select id="defaultColorMode" class="glass-input px-4 py-2.5 rounded-xl text-sm">
								<option value="random" ${!/^#[0-9a-f]{6}$/i.test(config.defaultColor || "") ? "selected" : ""}>Random</option>
								<option value="custom" ${/^#[0-9a-f]{6}$/i.test(config.defaultColor || "") ? "selected" : ""}>Tùy chọn</option>
							</select>
							<input type="color" id="defaultColorPicker" value="${/^#[0-9a-f]{6}$/i.test(config.defaultColor || "") ? config.defaultColor : "#5865F2"}" class="h-11 w-14 rounded-xl cursor-pointer bg-transparent border border-slate-700">
						</div>
						<p class="text-xs text-slate-400 mt-1.5">Chọn Random hoặc dùng bảng màu để đặt màu Embed.</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-gear text-indigo-400 mr-1.5"></i> Command Option Prefix (Moptions)
						</label>
						<input type="text" id="Moptions" value="${config.Moptions || "--"}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="--">
						<p class="text-xs text-slate-400 mt-1.5">Ký tự bắt đầu cho các tham số lệnh tùy chọn.</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Default language / Ngôn ngữ mặc định / デフォルト言語 (DefaultLang)</label>
						<select id="defaultLang" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">${languageOptions}</select>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Chủ sở hữu bot</label>
						<div class="flex gap-2">
							<input id="ownerSearch" type="search" class="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm" placeholder="Tìm user đã gặp hoặc nhập User ID">
							<button type="button" onclick="searchDirectory('users')" class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">Tìm</button>
						</div>
						<div id="ownerSearchResults" class="space-y-1 mt-2"></div>
						<div id="ownerSelections" class="flex flex-wrap gap-2 mt-2"></div>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Developer Guilds</label>
						<div class="flex gap-2">
							<input id="guildSearch" type="search" class="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm" placeholder="Tìm tên server hoặc nhập Guild ID">
							<button type="button" onclick="searchDirectory('guilds')" class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">Tìm</button>
						</div>
						<div id="guildSearchResults" class="space-y-1 mt-2"></div>
						<div id="guildSelections" class="flex flex-wrap gap-2 mt-2"></div>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Disabled commands / Lệnh bị vô hiệu hóa / 無効にするコマンド</label>
						<div id="disabledCommands" class="space-y-2" data-commands="${commandsData}" data-disabled="${disabledData}">
							<div id="disabledCommandChips" class="flex flex-wrap gap-2 min-h-[2rem]"></div>
							<div class="relative">
								<input id="disabledCommandSearch" type="text" autocomplete="off" spellcheck="false" placeholder="Search command to disable... / Tìm lệnh cần tắt... / 無効にするコマンドを検索..." class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" role="combobox" aria-expanded="false" aria-controls="disabledCommandList">
								<div id="disabledCommandList" role="listbox" class="hidden absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-slate-900 border border-slate-600 shadow-2xl p-1"></div>
							</div>
							<div class="flex items-center justify-between gap-3">
								<p class="text-xs text-slate-400">Click a command to disable it, click × to enable it again. / Bấm vào lệnh để tắt, bấm × để bật lại. / コマンドをクリックして無効化、×で再び有効化します。</p>
								<button type="button" id="disabledCommandClear" class="shrink-0 text-xs text-rose-300 hover:text-rose-200">Clear all / Xóa hết / すべて削除</button>
							</div>
						</div>
					</div>
				</div>

				<div class="pt-4 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
						<div>
							<div class="font-medium text-sm text-slate-200">Tự động Deploy Slash Commands</div>
							<div class="text-xs text-slate-400 mt-0.5">Tự động đăng ký các slash command lên Discord khi khởi động.</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" id="deploy" class="sr-only peer" ${config.deploy ? "checked" : ""}>
							<div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
						</label>
					</div>

					<div class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
						<div>
							<div class="font-medium text-sm text-slate-200">Tìm kiếm hình ảnh (ImageSearch)</div>
							<div class="text-xs text-slate-400 mt-0.5">Bật tính năng tìm kiếm ảnh (tắt trên server yếu để tiết kiệm tài nguyên).</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" id="ImageSearch" class="sr-only peer" ${config.ImageSearch ? "checked" : ""}>
							<div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
						</label>
					</div>
				</div>
			</div>

			<!-- Tab 2: Trạng thái & Hoạt động -->
			<div id="tab-presence" class="tab-content space-y-6 hidden">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-circle-dot text-emerald-400 mr-1.5"></i> Trạng thái Bot (Status)
						</label>
						<select id="botStatus" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
							<option value="online" ${botConfig.Status === "online" ? "selected" : ""}>🟢 Trực tuyến (online)</option>
							<option value="idle" ${botConfig.Status === "idle" ? "selected" : ""}>🟡 Chờ (idle)</option>
							<option value="dnd" ${botConfig.Status === "dnd" ? "selected" : ""}>🔴 Đừng làm phiền (dnd)</option>
							<option value="invisible" ${botConfig.Status === "invisible" ? "selected" : ""}>⚪ Ẩn (invisible)</option>
						</select>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-gamepad text-indigo-400 mr-1.5"></i> Kiểu hoạt động (Activity Type)
						</label>
						<select id="activityType" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
							<option value="PLAYING" ${botConfig.ActivityType === "PLAYING" ? "selected" : ""}>Đang chơi (PLAYING)</option>
							<option value="LISTENING" ${botConfig.ActivityType === "LISTENING" ? "selected" : ""}>Đang nghe (LISTENING)</option>
							<option value="WATCHING" ${botConfig.ActivityType === "WATCHING" ? "selected" : ""}>Đang xem (WATCHING)</option>
							<option value="STREAMING" ${botConfig.ActivityType === "STREAMING" ? "selected" : ""}>Đang phát trực tiếp (STREAMING)</option>
							<option value="Custom" ${botConfig.ActivityType === "Custom" ? "selected" : ""}>Tùy chỉnh (Custom)</option>
						</select>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-comment-dots text-indigo-400 mr-1.5"></i> Tên hoạt động (Activity Name)
						</label>
						<input type="text" id="activityName" value="${botConfig.ActivityName || "/help"}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="Ví dụ: /help | Âm nhạc chất lượng cao">
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/60">
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-image text-indigo-400 mr-1.5"></i> URL Ảnh Banner
						</label>
						<input type="url" id="banner" value="${botConfig.Banner || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://...">
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-panorama text-indigo-400 mr-1.5"></i> URL Ảnh Nền Web (webBackground)
						</label>
						<input type="url" id="webBackground" value="${botConfig.webBackground || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://...">
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-triangle-exclamation text-amber-400 mr-1.5"></i> Kênh ghi nhật ký lỗi (ErrorLog)
						</label>
						<div class="flex gap-2">
							<input type="search" id="errorLogSearch" class="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm" placeholder="Tìm tên kênh hoặc nhập Channel ID">
							<button type="button" onclick="searchDirectory('channels', 'errorLog')" class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">Tìm</button>
						</div>
						<input type="hidden" id="errorLog" name="errorLog" value="${botConfig.ErrorLog || ""}">
						<div id="errorLogSearchResults" class="space-y-1 mt-2"></div>
						<div id="errorLogSelection" class="mt-2"></div>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-bullhorn text-indigo-400 mr-1.5"></i> Kênh nhận phản hồi (FeedBack)
						</label>
						<div class="flex gap-2">
							<input type="search" id="feedbackSearch" class="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm" placeholder="Tìm tên kênh hoặc nhập Channel ID">
							<button type="button" onclick="searchDirectory('channels', 'feedback')" class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">Tìm</button>
						</div>
						<input type="hidden" id="feedback" name="feedback" value="${botConfig.FeedBack || ""}">
						<div id="feedbackSearchResults" class="space-y-1 mt-2"></div>
						<div id="feedbackSelection" class="mt-2"></div>
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-headset text-indigo-400 mr-1.5"></i> Server Hỗ Trợ (Support Server)
						</label>
						<input type="url" id="supportServer" value="${botConfig.SupportServer || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://discord.gg/...">
					</div>

					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">
							<i class="fa-solid fa-link text-indigo-400 mr-1.5"></i> Link Mời Bot (Invite Link)
						</label>
						<input type="url" id="inviteBot" value="${botConfig.InviteBot || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://discord.com/oauth2/authorize?client_id=...">
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-700/60">
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Dashboard URL</label>
						<input type="url" id="dashboardUrl" value="${webAppConfig.dashboardUrl || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://...">
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Music Controller URL</label>
						<input type="url" id="musicControllerUrl" value="${webAppConfig.musicControllerUrl || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://...">
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Status URL</label>
						<input type="url" id="statusUrl" value="${webAppConfig.statusUrl || ""}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm" placeholder="https://...">
					</div>
				</div>
			</div>

			<!-- Tab 3: Trình phát nhạc -->
			<div id="tab-player" class="tab-content space-y-6 hidden">
				<div class="pt-4 border-t border-slate-700/60">
					<h3 class="text-sm font-semibold text-slate-200 mb-4">Cấu hình player mặc định (PlayerConfig)</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<label class="block text-sm font-medium text-slate-300 mb-2">Volume mặc định</label>
							<select id="playerVolumeMode" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
								<option value="auto" ${defaultPlayerConfig.volume === "auto" || defaultPlayerConfig.volume === undefined ? "selected" : ""}>Tự động (auto)</option>
								<option value="custom" ${defaultPlayerConfig.volume !== undefined && defaultPlayerConfig.volume !== "auto" ? "selected" : ""}>Giá trị tùy chỉnh</option>
							</select>
							<input type="number" min="0" max="200" id="playerVolume" value="${typeof defaultPlayerConfig.volume === "number" ? defaultPlayerConfig.volume : 50}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm mt-2">
							<p class="text-xs text-slate-400 mt-1.5">Chọn tự động hoặc nhập mức âm lượng mặc định.</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-slate-300 mb-2">Thời gian rời voice khi hết bài (ms)</label>
							<input type="number" min="0" id="leaveOnEndCooldown" value="${defaultPlayerConfig.leaveOnEndCooldown ?? 50000}" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
						</div>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
						<label class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<input type="checkbox" id="playerSelfDeaf" class="accent-indigo-500 h-4 w-4" ${defaultPlayerConfig.selfDeaf !== false ? "checked" : ""}>
							<span class="text-sm text-slate-200">Bot vào voice ở chế độ deaf (selfDeaf)</span>
						</label>
						<label class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<input type="checkbox" id="playerLeaveOnEnd" class="accent-indigo-500 h-4 w-4" ${defaultPlayerConfig.leaveOnEnd !== false ? "checked" : ""}>
							<span class="text-sm text-slate-200">Rời voice khi hết bài</span>
						</label>
						<label class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<input type="checkbox" id="pauseOnEmpty" name="pauseOnEmpty" class="accent-indigo-500 h-4 w-4" ${defaultPlayerConfig.pauseOnEmpty !== false ? "checked" : ""}>
							<span class="text-sm text-slate-200">Tự động tạm dừng khi voice không còn người nghe (pauseOnEmpty)</span>
						</label>
						<label class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
							<input type="checkbox" id="playerChangeStatus" class="accent-indigo-500 h-4 w-4" ${defaultPlayerConfig.changeStatus !== false ? "checked" : ""}>
							<span class="text-sm text-slate-200">Đổi trạng thái voice thành tên bài hát</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Tab 4: Nâng cao & JSON -->
			<div id="tab-dev" class="tab-content space-y-6 hidden">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<label class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 cursor-pointer">
						<div>
							<div class="font-medium text-sm text-slate-200">Discord.js Debug</div>
							<div class="text-xs text-slate-400 mt-0.5">Bật log debug của discord.js.</div>
						</div>
						<input type="checkbox" id="djsDebug" class="accent-indigo-500 h-4 w-4" ${devConfig.DJS_DEBUG ? "checked" : ""}>
					</label>
					<label class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 cursor-pointer">
						<div>
							<div class="font-medium text-sm text-slate-200">Player Debug</div>
							<div class="text-xs text-slate-400 mt-0.5">Bật log debug của player.</div>
						</div>
						<input type="checkbox" id="playerDebug" class="accent-indigo-500 h-4 w-4" ${devConfig.Player_DEBUG ? "checked" : ""}>
					</label>
					<label class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 cursor-pointer">
						<div>
							<div class="font-medium text-sm text-slate-200">Voice Extension Debug</div>
							<div class="text-xs text-slate-400 mt-0.5">Bật log debug của voice extension.</div>
						</div>
						<input type="checkbox" id="voiceExtDebug" class="accent-indigo-500 h-4 w-4" ${devConfig.voiceExt_DEBUG ? "checked" : ""}>
					</label>
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Player Debug Level</label>
						<select id="debugLevel" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
							${["off", "error", "warn", "info", "debug", "verbose", "time"].map((level) => `<option value="${level}" ${devConfig.debugLevel === level ? "selected" : ""}>${level}</option>`).join("")}
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-slate-300 mb-2">Logger level</label>
						<select id="loggerLevel" class="glass-input w-full px-4 py-2.5 rounded-xl text-sm">
							${["", "info", "debug", "warn", "error"].map((level) => `<option value="${level}" ${devConfig.logger === level ? "selected" : ""}>${level || "all"}</option>`).join("")}
						</select>
					</div>
					${[
						["giveawayEnabled", "Giveaway", "Giveaway"],
						["autoResponderEnabled", "AutoResponder", "AutoResponder"],
						["ticketEnabled", "Ticket", "ticket"],
						["welcomerEnabled", "Welcomer", "welcomer"],
						["aiEnabled", "AI", "ai"],
						["aiAutoPlayEnabled", "AI AutoPlay", "aiAutoPlay"],
						["guildCommandEnabled", "GuildCommand", "GuildCommand"],
					]
						.map(
							([id, label, key]) => `
					<label class="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
						<input type="checkbox" id="${id}" class="accent-indigo-500 h-4 w-4" ${devConfig[key] ? "checked" : ""}>
						<span class="text-sm text-slate-200">${label}</span>
					</label>`,
						)
						.join("")}
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
						<div>
							<div class="font-medium text-sm text-slate-200">Prisma Debug Log</div>
							<div class="text-xs text-slate-400 mt-0.5">In nhật ký chi tiết truy vấn database Prisma ra console.</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" id="prismaDebug" class="sr-only peer" ${devConfig.prisma_DEBUG ? "checked" : ""}>
							<div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
						</label>
					</div>

					<div class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
						<div>
							<div class="font-medium text-sm text-slate-200">Loader Debug Log</div>
							<div class="text-xs text-slate-400 mt-0.5">In nhật ký theo dõi quá trình tải module và reload.</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" id="loaderDebug" class="sr-only peer" ${devConfig.loaderDebug ? "checked" : ""}>
							<div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
						</label>
					</div>
				</div>

				<div class="pt-4 border-t border-slate-700/60">
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm font-medium text-slate-300">
							<i class="fa-solid fa-code text-indigo-400 mr-1.5"></i> Chỉnh sửa cấu hình dạng JSON trực tiếp
						</label>
						<div class="flex gap-2">
							<button type="button" onclick="syncFormToJson()" class="px-3 py-1 rounded-lg text-xs font-medium glass-input hover:bg-slate-700 transition">
								<i class="fa-solid fa-arrow-down mr-1"></i> Form ➔ JSON
							</button>
							<button type="button" onclick="applyJsonToForm()" class="px-3 py-1 rounded-lg text-xs font-medium glass-input hover:bg-slate-700 transition">
								<i class="fa-solid fa-arrow-up mr-1"></i> JSON ➔ Form
							</button>
						</div>
					</div>
					<textarea id="rawJsonEditor" rows="16" class="font-mono glass-input w-full p-4 rounded-xl text-xs leading-relaxed text-indigo-200"></textarea>
					<p class="text-xs text-slate-400 mt-1.5">Bạn có thể sửa trực tiếp cấu hình nâng cao dạng JSON tại đây trước khi bấm 'Lưu cấu hình'.</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Toast Alert Notification -->
	<div id="toast" class="toast flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium" role="status" aria-live="polite" aria-hidden="true">
		<i id="toast-icon" class="text-lg"></i>
		<span id="toast-msg"></span>
	</div>

	<script>
		let fullConfig = ${JSON.stringify(config)};
		let selectedOwnerIds = ${JSON.stringify(Array.isArray(config.OwnerID) ? config.OwnerID : []).replaceAll("<", "\\u003c")}.map(id => ({ id, label: id }));
		let selectedGuildIds = ${JSON.stringify(Array.isArray(config.DevGuild) ? config.DevGuild : []).replaceAll("<", "\\u003c")}.map(id => ({ id, label: id }));
	let selectedChannels = ${JSON.stringify({
		errorLog:
			botConfig.ErrorLog ?
				{ id: botConfig.ErrorLog, label: client?.channels?.cache?.get(botConfig.ErrorLog)?.name || botConfig.ErrorLog }
			:	null,
		feedback:
			botConfig.FeedBack ?
				{ id: botConfig.FeedBack, label: client?.channels?.cache?.get(botConfig.FeedBack)?.name || botConfig.FeedBack }
			:	null,
	}).replaceAll("<", "\\u003c")};

		function renderSelections(type) {
			if (type === 'channels') {
				['errorLog', 'feedback'].forEach(field => {
					const container = document.getElementById(field + 'Selection');
					container.replaceChildren();
					const channel = selectedChannels[field];
					if (!channel) return;
					const chip = document.createElement('span');
					chip.className = 'inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-100';
					chip.append(document.createTextNode(channel.label + ' (' + channel.id + ')'));
					const removeButton = document.createElement('button');
					removeButton.type = 'button';
					removeButton.textContent = '×';
					removeButton.setAttribute('aria-label', 'Xóa kênh ' + channel.label);
					removeButton.onclick = () => {
						selectedChannels[field] = null;
						document.getElementById(field).value = '';
						renderSelections('channels');
					};
					chip.append(removeButton);
					container.append(chip);
				});
				return;
			}

			const isUser = type === 'users';
			const items = isUser ? selectedOwnerIds : selectedGuildIds;
			const container = document.getElementById(isUser ? 'ownerSelections' : 'guildSelections');
			container.replaceChildren();
			items.forEach(item => {
				const chip = document.createElement('span');
				chip.className = 'inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-100';
				chip.append(document.createTextNode(item.label + ' (' + item.id + ')'));
				const removeButton = document.createElement('button');
				removeButton.type = 'button';
				removeButton.textContent = '×';
				removeButton.setAttribute('aria-label', 'Xóa ' + item.label);
				removeButton.onclick = () => {
					const selected = isUser ? selectedOwnerIds : selectedGuildIds;
					selected.splice(selected.findIndex(value => value.id === item.id), 1);
					renderSelections(type);
				};
				chip.append(removeButton);
				container.append(chip);
			});
		}

		async function searchDirectory(type, field) {
			const isUser = type === 'users';
			const isChannel = type === 'channels';
			const inputId = isChannel ? (field === 'errorLog' ? 'errorLogSearch' : 'feedbackSearch') : (isUser ? 'ownerSearch' : 'guildSearch');
			const resultsId = isChannel ? field + 'SearchResults' : (isUser ? 'ownerSearchResults' : 'guildSearchResults');
			const input = document.getElementById(inputId);
			const results = document.getElementById(resultsId);
			results.replaceChildren();
			try {
				const response = await fetch('/api/config/lookups?q=' + encodeURIComponent(input.value.trim()), {
					headers: { 'Accept': 'application/json' }
				});
				const result = await response.json();
				if (!response.ok || result.status !== 'OK') throw new Error(result.error || 'Không thể tìm kiếm.');
				const items = isChannel ? result.channels : (isUser ? result.users : result.guilds);
				if (!items.length) {
					results.textContent = 'Không tìm thấy kết quả.';
					return;
				}
				items.forEach(item => {
					const button = document.createElement('button');
					button.type = 'button';
					button.className = 'block w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700';
					button.textContent = item.label + ' (' + item.id + ')';
					button.onclick = () => {
						if (isChannel) {
							selectedChannels[field] = item;
							document.getElementById(field).value = item.id;
							renderSelections('channels');
						} else {
							const selected = isUser ? selectedOwnerIds : selectedGuildIds;
							if (!selected.some(value => value.id === item.id)) selected.push(item);
							renderSelections(type);
						}
						results.replaceChildren();
						input.value = '';
					};
					results.append(button);
				});
			} catch (error) {
				results.textContent = error.message;
			}
		}

		function switchTab(tabId) {
			document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
			document.querySelectorAll('.tab-btn').forEach(btn => {
				btn.classList.remove('active');
				btn.classList.add('text-slate-300');
			});

			const activeContent = document.getElementById('tab-' + tabId);
			if (activeContent) activeContent.classList.remove('hidden');

			const activeBtn = document.getElementById('tab-' + tabId + '-btn');
			if (activeBtn) {
				activeBtn.classList.add('active');
				activeBtn.classList.remove('text-slate-300');
			}

			if (tabId === 'dev') {
				syncFormToJson();
			}
		}

		let disabledCommandNames = [];
		const disabledCommandRoot = document.getElementById('disabledCommands');
		const allCommandNames = JSON.parse(disabledCommandRoot.dataset.commands || '[]');
		disabledCommandNames = JSON.parse(disabledCommandRoot.dataset.disabled || '[]');

		function renderDisabledCommands() {
			const chips = document.getElementById('disabledCommandChips');
			chips.replaceChildren();
			if (!disabledCommandNames.length) {
				const empty = document.createElement('span');
				empty.className = 'text-xs text-slate-500 py-1.5';
				empty.textContent = 'Chưa tắt lệnh nào / No disabled commands';
				chips.appendChild(empty);
			}
			disabledCommandNames.forEach(name => {
				const chip = document.createElement('span');
				chip.className = 'inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-100';
				chip.append(document.createTextNode(name));
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.textContent = '×';
				remove.className = 'text-slate-300 hover:text-rose-300';
				remove.setAttribute('aria-label', 'Bật lại lệnh ' + name);
				remove.addEventListener('click', () => {
					disabledCommandNames = disabledCommandNames.filter(item => item !== name);
					renderDisabledCommands();
					syncAdvancedFormChanges({ target: disabledCommandRoot });
				});
				chip.appendChild(remove);
				chips.appendChild(chip);
			});
			renderDisabledCommandList();
		}

		function renderDisabledCommandList() {
			const list = document.getElementById('disabledCommandList');
			const query = document.getElementById('disabledCommandSearch').value.trim().toLowerCase();
			list.replaceChildren();
			const matches = allCommandNames.filter(name => !disabledCommandNames.includes(name) && name.toLowerCase().includes(query));
			if (!matches.length) {
				const empty = document.createElement('div');
				empty.className = 'px-3 py-2 text-xs text-slate-400';
				empty.textContent = query ? 'Không có lệnh phù hợp / No matching command' : 'Đã chọn hết / All selected';
				list.appendChild(empty);
				return;
			}
			matches.forEach(name => {
				const option = document.createElement('button');
				option.type = 'button';
				option.setAttribute('role', 'option');
				option.dataset.name = name;
				option.className = 'block w-full text-left px-3 py-1.5 rounded-lg text-sm text-slate-200 hover:bg-indigo-600/40 focus:bg-indigo-600/40 focus:outline-none';
				option.textContent = name;
				list.appendChild(option);
			});
		}

		function addDisabledCommand(name) {
			if (!name || disabledCommandNames.includes(name)) return;
			disabledCommandNames.push(name);
			disabledCommandNames.sort((a, b) => a.localeCompare(b));
			document.getElementById('disabledCommandSearch').value = '';
			renderDisabledCommands();
			syncAdvancedFormChanges({ target: disabledCommandRoot });
		}

		function setDisabledCommandListOpen(open) {
			document.getElementById('disabledCommandList').classList.toggle('hidden', !open);
			document.getElementById('disabledCommandSearch').setAttribute('aria-expanded', open ? 'true' : 'false');
		}

		(function initDisabledCommands() {
			const search = document.getElementById('disabledCommandSearch');
			const list = document.getElementById('disabledCommandList');
			search.addEventListener('focus', () => { renderDisabledCommandList(); setDisabledCommandListOpen(true); });
			search.addEventListener('input', () => { renderDisabledCommandList(); setDisabledCommandListOpen(true); });
			search.addEventListener('keydown', event => {
				if (event.key === 'Enter') {
					event.preventDefault();
					const first = list.querySelector('[data-name]');
					if (first) addDisabledCommand(first.dataset.name);
				} else if (event.key === 'Escape') {
					setDisabledCommandListOpen(false);
				} else if (event.key === 'ArrowDown') {
					event.preventDefault();
					setDisabledCommandListOpen(true);
					const first = list.querySelector('[data-name]');
					if (first) first.focus();
				}
			});
			list.addEventListener('click', event => {
				const option = event.target.closest('[data-name]');
				if (option) { addDisabledCommand(option.dataset.name); search.focus(); }
			});
			list.addEventListener('keydown', event => {
				const current = document.activeElement;
				if (event.key === 'ArrowDown' && current.nextElementSibling) { event.preventDefault(); current.nextElementSibling.focus(); }
				else if (event.key === 'ArrowUp') { event.preventDefault(); (current.previousElementSibling || search).focus(); }
				else if (event.key === 'Escape') { setDisabledCommandListOpen(false); search.focus(); }
			});
			document.addEventListener('click', event => {
				if (!disabledCommandRoot.contains(event.target)) setDisabledCommandListOpen(false);
			});
			document.getElementById('disabledCommandClear').addEventListener('click', () => {
				disabledCommandNames = [];
				renderDisabledCommands();
				syncAdvancedFormChanges({ target: disabledCommandRoot });
			});
			renderDisabledCommands();
		})();

		let toastTimer = null;
		function showToast(msg, isSuccess = true) {
			const toast = document.getElementById('toast');
			const icon = document.getElementById('toast-icon');
			const text = document.getElementById('toast-msg');

			text.textContent = msg;
			if (isSuccess) {
				toast.className = 'toast show flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 backdrop-blur-md';
				icon.className = 'fa-solid fa-circle-check text-emerald-400';
			} else {
				toast.className = 'toast show flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium bg-rose-950/90 border border-rose-500/40 text-rose-200 backdrop-blur-md';
				icon.className = 'fa-solid fa-circle-exclamation text-rose-400';
			}

			toast.setAttribute('aria-hidden', 'false');
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => {
				toast.classList.remove('show');
				toast.setAttribute('aria-hidden', 'true');
			}, 4000);
		}

		function readNumber(id, fallback) {
			const value = document.getElementById(id).valueAsNumber;
			return Number.isFinite(value) ? value : fallback;
		}

		function collectFormData() {
			const data = JSON.parse(JSON.stringify(fullConfig));
			delete data.playerConfig;
			data.prefix = document.getElementById('prefix').value;
			data.defaultCooldownDuration = readNumber('defaultCooldownDuration', 5000);
			data.defaultColor = document.getElementById('defaultColorMode').value === 'random'
				? 'Random'
				: document.getElementById('defaultColorPicker').value;
			data.Moptions = document.getElementById('Moptions').value;
			data.deploy = document.getElementById('deploy').checked;
			data.ImageSearch = document.getElementById('ImageSearch').checked;
			data.DefaultLang = document.getElementById('defaultLang').value;
			data.OwnerID = selectedOwnerIds.map(item => item.id);
			data.DevGuild = selectedGuildIds.map(item => item.id);
			data.disabledCommands = disabledCommandNames.slice();

			data.botConfig = data.botConfig || {};
			data.botConfig.Status = document.getElementById('botStatus').value;
			data.botConfig.ActivityType = document.getElementById('activityType').value;
			data.botConfig.ActivityName = document.getElementById('activityName').value;
			data.botConfig.Banner = document.getElementById('banner').value;
			data.botConfig.webBackground = document.getElementById('webBackground').value;
			data.botConfig.ErrorLog = selectedChannels.errorLog?.id || '';
			data.botConfig.FeedBack = selectedChannels.feedback?.id || '';
			data.botConfig.SupportServer = document.getElementById('supportServer').value;
			data.botConfig.InviteBot = document.getElementById('inviteBot').value;

			data.webAppConfig = data.webAppConfig || {};
			data.webAppConfig.dashboardUrl = document.getElementById('dashboardUrl').value;
			data.webAppConfig.musicControllerUrl = document.getElementById('musicControllerUrl').value;
			data.webAppConfig.statusUrl = document.getElementById('statusUrl').value;

			data.PlayerConfig = data.PlayerConfig || {};
			data.PlayerConfig.selfDeaf = document.getElementById('playerSelfDeaf').checked;
			data.PlayerConfig.volume = document.getElementById('playerVolumeMode').value === 'auto'
				? 'auto'
				: readNumber('playerVolume', 50);
			data.PlayerConfig.leaveOnEmpty = false;
			data.PlayerConfig.leaveOnEnd = document.getElementById('playerLeaveOnEnd').checked;
			data.PlayerConfig.leaveOnEndCooldown = readNumber('leaveOnEndCooldown', 50000);
			data.PlayerConfig.changeStatus = document.getElementById('playerChangeStatus').checked;
			data.PlayerConfig.pauseOnEmpty = document.getElementById('pauseOnEmpty').checked;

			data.DevConfig = data.DevConfig || {};
			data.DevConfig.DJS_DEBUG = document.getElementById('djsDebug').checked;
			data.DevConfig.Player_DEBUG = document.getElementById('playerDebug').checked;
			data.DevConfig.debugLevel = document.getElementById('debugLevel').value;
			data.DevConfig.voiceExt_DEBUG = document.getElementById('voiceExtDebug').checked;
			data.DevConfig.prisma_DEBUG = document.getElementById('prismaDebug').checked;
			data.DevConfig.loaderDebug = document.getElementById('loaderDebug').checked;
			data.DevConfig.Giveaway = document.getElementById('giveawayEnabled').checked;
			data.DevConfig.AutoResponder = document.getElementById('autoResponderEnabled').checked;
			data.DevConfig.ticket = document.getElementById('ticketEnabled').checked;
			data.DevConfig.welcomer = document.getElementById('welcomerEnabled').checked;
			data.DevConfig.ai = document.getElementById('aiEnabled').checked;
			data.DevConfig.aiAutoPlay = document.getElementById('aiAutoPlayEnabled').checked;
			data.DevConfig.GuildCommand = document.getElementById('guildCommandEnabled').checked;
			data.DevConfig.logger = document.getElementById('loggerLevel').value;

			return data;
		}

		function syncFormToJson() {
			const data = collectFormData();
			document.getElementById('rawJsonEditor').value = JSON.stringify(data, null, 2);
		}

		function syncAdvancedFormChanges(event) {
			if (event.target.id === 'rawJsonEditor') return;
			if (!document.getElementById('tab-dev').classList.contains('hidden')) {
				syncFormToJson();
			}
		}

		function applyJsonToForm() {
			try {
				const parsed = JSON.parse(document.getElementById('rawJsonEditor').value);
				fullConfig = parsed;

				if (parsed.prefix !== undefined) document.getElementById('prefix').value = parsed.prefix;
				if (parsed.defaultCooldownDuration !== undefined) document.getElementById('defaultCooldownDuration').value = parsed.defaultCooldownDuration;
				if (parsed.defaultColor !== undefined) {
					const isCustomColor = /^#[0-9a-f]{6}$/i.test(parsed.defaultColor);
					document.getElementById('defaultColorMode').value = isCustomColor ? 'custom' : 'random';
					if (isCustomColor) document.getElementById('defaultColorPicker').value = parsed.defaultColor;
				}
				if (parsed.Moptions !== undefined) document.getElementById('Moptions').value = parsed.Moptions;
				if (parsed.deploy !== undefined) document.getElementById('deploy').checked = !!parsed.deploy;
				if (parsed.ImageSearch !== undefined) document.getElementById('ImageSearch').checked = !!parsed.ImageSearch;
				if (parsed.DefaultLang !== undefined) document.getElementById('defaultLang').value = parsed.DefaultLang;
				if (parsed.OwnerID !== undefined) {
					selectedOwnerIds = (Array.isArray(parsed.OwnerID) ? parsed.OwnerID : []).map(id => ({ id, label: id }));
					renderSelections('users');
				}
				if (parsed.DevGuild !== undefined) {
					selectedGuildIds = (Array.isArray(parsed.DevGuild) ? parsed.DevGuild : []).map(id => ({ id, label: id }));
					renderSelections('guilds');
				}
				if (parsed.disabledCommands !== undefined) {
					disabledCommandNames = Array.from(new Set((Array.isArray(parsed.disabledCommands) ? parsed.disabledCommands : []).filter(name => typeof name === 'string' && name)));
					renderDisabledCommands();
				}

				if (parsed.botConfig) {
					if (parsed.botConfig.Status) document.getElementById('botStatus').value = parsed.botConfig.Status;
					if (parsed.botConfig.ActivityType) document.getElementById('activityType').value = parsed.botConfig.ActivityType;
					if (parsed.botConfig.ActivityName) document.getElementById('activityName').value = parsed.botConfig.ActivityName;
					if (parsed.botConfig.Banner) document.getElementById('banner').value = parsed.botConfig.Banner;
					if (parsed.botConfig.webBackground) document.getElementById('webBackground').value = parsed.botConfig.webBackground;
					if (parsed.botConfig.ErrorLog !== undefined) {
						selectedChannels.errorLog = parsed.botConfig.ErrorLog ? { id: parsed.botConfig.ErrorLog, label: parsed.botConfig.ErrorLog } : null;
						document.getElementById('errorLog').value = parsed.botConfig.ErrorLog;
					}
					if (parsed.botConfig.FeedBack !== undefined) {
						selectedChannels.feedback = parsed.botConfig.FeedBack ? { id: parsed.botConfig.FeedBack, label: parsed.botConfig.FeedBack } : null;
						document.getElementById('feedback').value = parsed.botConfig.FeedBack;
					}
					if (parsed.botConfig.SupportServer) document.getElementById('supportServer').value = parsed.botConfig.SupportServer;
					if (parsed.botConfig.InviteBot) document.getElementById('inviteBot').value = parsed.botConfig.InviteBot;
					renderSelections('channels');
				}

				if (parsed.webAppConfig) {
					if (parsed.webAppConfig.dashboardUrl !== undefined) document.getElementById('dashboardUrl').value = parsed.webAppConfig.dashboardUrl;
					if (parsed.webAppConfig.musicControllerUrl !== undefined) document.getElementById('musicControllerUrl').value = parsed.webAppConfig.musicControllerUrl;
					if (parsed.webAppConfig.statusUrl !== undefined) document.getElementById('statusUrl').value = parsed.webAppConfig.statusUrl;
				}

				if (parsed.PlayerConfig) {
					if (parsed.PlayerConfig.selfDeaf !== undefined) document.getElementById('playerSelfDeaf').checked = !!parsed.PlayerConfig.selfDeaf;
					if (parsed.PlayerConfig.volume !== undefined) {
						const isAutoVolume = parsed.PlayerConfig.volume === 'auto';
						document.getElementById('playerVolumeMode').value = isAutoVolume ? 'auto' : 'custom';
						if (!isAutoVolume) document.getElementById('playerVolume').value = parsed.PlayerConfig.volume;
					}
					if (parsed.PlayerConfig.leaveOnEnd !== undefined) document.getElementById('playerLeaveOnEnd').checked = !!parsed.PlayerConfig.leaveOnEnd;
					if (parsed.PlayerConfig.leaveOnEndCooldown !== undefined) document.getElementById('leaveOnEndCooldown').value = parsed.PlayerConfig.leaveOnEndCooldown;
					if (parsed.PlayerConfig.changeStatus !== undefined) document.getElementById('playerChangeStatus').checked = !!parsed.PlayerConfig.changeStatus;
					if (parsed.PlayerConfig.pauseOnEmpty !== undefined) document.getElementById('pauseOnEmpty').checked = !!parsed.PlayerConfig.pauseOnEmpty;
				}

				if (parsed.DevConfig) {
					if (parsed.DevConfig.DJS_DEBUG !== undefined) document.getElementById('djsDebug').checked = !!parsed.DevConfig.DJS_DEBUG;
					if (parsed.DevConfig.Player_DEBUG !== undefined) document.getElementById('playerDebug').checked = !!parsed.DevConfig.Player_DEBUG;
					if (parsed.DevConfig.debugLevel !== undefined) document.getElementById('debugLevel').value = parsed.DevConfig.debugLevel;
					if (parsed.DevConfig.voiceExt_DEBUG !== undefined) document.getElementById('voiceExtDebug').checked = !!parsed.DevConfig.voiceExt_DEBUG;
					if (parsed.DevConfig.prisma_DEBUG !== undefined) document.getElementById('prismaDebug').checked = !!parsed.DevConfig.prisma_DEBUG;
					if (parsed.DevConfig.loaderDebug !== undefined) document.getElementById('loaderDebug').checked = !!parsed.DevConfig.loaderDebug;
					if (parsed.DevConfig.Giveaway !== undefined) document.getElementById('giveawayEnabled').checked = !!parsed.DevConfig.Giveaway;
					if (parsed.DevConfig.AutoResponder !== undefined) document.getElementById('autoResponderEnabled').checked = !!parsed.DevConfig.AutoResponder;
					if (parsed.DevConfig.ticket !== undefined) document.getElementById('ticketEnabled').checked = !!parsed.DevConfig.ticket;
					if (parsed.DevConfig.welcomer !== undefined) document.getElementById('welcomerEnabled').checked = !!parsed.DevConfig.welcomer;
					if (parsed.DevConfig.ai !== undefined) document.getElementById('aiEnabled').checked = !!parsed.DevConfig.ai;
					if (parsed.DevConfig.aiAutoPlay !== undefined) document.getElementById('aiAutoPlayEnabled').checked = !!parsed.DevConfig.aiAutoPlay;
					if (parsed.DevConfig.GuildCommand !== undefined) document.getElementById('guildCommandEnabled').checked = !!parsed.DevConfig.GuildCommand;
					if (parsed.DevConfig.logger !== undefined) document.getElementById('loggerLevel').value = parsed.DevConfig.logger;
				}

				showToast("Đã đồng bộ từ JSON vào Form!");
			} catch (err) {
				showToast("JSON không hợp lệ: " + err.message, false);
			}
		}

		async function saveConfiguration() {
			let payload;
			const isDevTabActive = !document.getElementById('tab-dev').classList.contains('hidden');
			if (isDevTabActive) {
				try {
					payload = JSON.parse(document.getElementById('rawJsonEditor').value);
				} catch (err) {
					return showToast("Lỗi định dạng JSON: " + err.message, false);
				}
			} else {
				payload = collectFormData();
			}

			try {
				const response = await fetch('/api/config', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				const result = await response.json();
				if (response.ok && result.status === 'OK') {
					fullConfig = result.config;
					syncFormToJson();
					showToast("Đã lưu cấu hình thành công!");
				} else {
					showToast(result.error || "Không thể lưu cấu hình.", false);
				}
			} catch (err) {
				showToast("Lỗi kết nối máy chủ: " + err.message, false);
			}
		}

		async function resetToDefault() {
			if (!confirm("Bạn có chắc chắn muốn khôi phục toàn bộ cấu hình về mặc định ban đầu không?")) return;
			try {
				const response = await fetch('/api/config/reset', {
					method: 'POST',
					headers: { 'Accept': 'application/json' }
				});
				const result = await response.json();
				if (response.ok && result.status === 'OK') {
					showToast("Đã khôi phục mặc định thành công! Đang tải lại...");
					setTimeout(() => window.location.reload(), 1200);
				} else {
					showToast(result.error || "Lỗi khôi phục cấu hình.", false);
				}
			} catch (err) {
				showToast("Lỗi: " + err.message, false);
			}
		}

		window.addEventListener('DOMContentLoaded', () => {
			renderSelections('users');
			renderSelections('guilds');
			renderSelections('channels');
			syncFormToJson();
			document.addEventListener('input', syncAdvancedFormChanges);
			document.addEventListener('change', syncAdvancedFormChanges);
			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.get('saved') === '1') {
				showToast("Đã lưu cấu hình thành công!");
				history.replaceState(null, '', window.location.pathname);
			}
		});
	</script>
	<script>${renderEnvScript({ loggedIn: isClientLoggedIn(), botId: getBotInfo()?.id || null, botName: getBotInfo()?.tag || "" })}</script>
</body>
</html>`;

		return context.html(html);
	};

	router.get("/config", renderSetupPage);
	router.get("/config/*", renderSetupPage);

	server.route("/", router);
};