/**
 * Helpers for the localhost config page (.env editor).
 * - ENV_SCHEMA: describes the known variables (used to build the UI).
 * - parseEnv / applyEnvChanges: read and edit .env in place (comments and unknown lines are preserved).
 * - testEnvValue: check a value (token, MONGO, API key...) BEFORE it is saved.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const ENV_SCHEMA = [
	{
		id: "discord",
		title: "Discord Bot",
		icon: "fa-brands fa-discord",
		fields: [
			{
				key: "TOKEN",
				label: "Bot token (TOKEN)",
				type: "secret",
				required: true,
				testable: "live",
				help: "Token bot chính. Lấy tại discord.com/developers/applications → Bot → Reset Token.",
			},
			{
				key: "MULTI_PLAYER_TOKEN",
				label: "Bot phụ phát nhạc (MULTI_PLAYER_TOKEN)",
				type: "tokenList",
				testable: "live",
				help: "Nhiều bot cùng phát nhạc trong 1 server. Mỗi token phải test thành công mới được thêm vào danh sách.",
			},
			{
				key: "DISCORD_CLIENT_SECRET",
				label: "Client secret (OAuth2)",
				type: "secret",
				testable: "live",
				help: "Dùng cho đăng nhập dashboard. Discord Developer Portal → OAuth2 → Client Secret.",
			},
		],
	},
	{
		id: "database",
		title: "Cơ sở dữ liệu",
		icon: "fa-solid fa-database",
		fields: [
			{
				key: "MONGO",
				label: "MongoDB URI (MONGO)",
				type: "secret",
				testable: "live",
				placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/ziji?retryWrites=true&w=majority",
				help: "Để trống hoặc kết nối lỗi thì bot tự dùng SQLite. Nên có tên database ở cuối (ví dụ /ziji).",
			},
			{
				key: "SQLITE_DATABASE_URL",
				label: "SQLite fallback (SQLITE_DATABASE_URL)",
				type: "text",
				testable: "live",
				placeholder: "file:./jsons/ziDB.sqlite",
				help: "Đường dẫn file SQLite dùng khi không có MONGO.",
			},
		],
	},
	{
		id: "apis",
		title: "API key",
		icon: "fa-solid fa-key",
		fields: [
			{
				key: "GEMINI_API_KEY",
				label: "Gemini (GEMINI_API_KEY)",
				type: "secret",
				testable: "live",
				help: "https://aistudio.google.com/apikey",
			},
			{
				key: "WEATHER_API_KEY",
				label: "OpenWeather (WEATHER_API_KEY)",
				type: "secret",
				testable: "live",
				help: "https://openweathermap.org/api — key mới tạo có thể cần vài phút để kích hoạt.",
			},
			{
				key: "OCR_API_KEY",
				label: "OCR.space (OCR_API_KEY)",
				type: "secret",
				testable: "format",
				help: "https://ocr.space/ocrapi — chỉ kiểm tra định dạng để không tốn quota.",
			},
		],
	},
	{
		id: "web",
		title: "Server & Web",
		icon: "fa-solid fa-globe",
		fields: [
			{ key: "SERVER_PORT", label: "Port API (SERVER_PORT)", type: "text", testable: "format", placeholder: "2003" },
			{
				key: "CORS",
				label: "CORS",
				type: "text",
				testable: "format",
				placeholder: "*",
				help: 'Dùng "*" hoặc danh sách origin cách nhau bằng dấu phẩy.',
			},
			{ key: "DASHBOARD_URL", label: "Dashboard URL", type: "text", testable: "live", placeholder: "http://localhost:3000/" },
			{ key: "API_URL", label: "API URL", type: "text", testable: "live", placeholder: "https://api.ziji.best" },
			{ key: "JWT_SECRET", label: "JWT secret", type: "secret", testable: "format", generate: true },
		],
	},
	{
		id: "system",
		title: "Hệ thống & Tunnel",
		icon: "fa-solid fa-server",
		fields: [
			{
				key: "DISABLE_UPDATE",
				label: "Tắt tự động cập nhật (DISABLE_UPDATE)",
				type: "select",
				options: ["true", "false"],
			},
			{
				key: "NODE_ENV",
				label: "NODE_ENV",
				type: "select",
				options: ["", "development", "production"],
				help: "Thường đã được đặt bởi npm start / npm run dev.",
			},
			{
				key: "FFMPEG_PATH",
				label: "Đường dẫn ffmpeg (FFMPEG_PATH)",
				type: "text",
				testable: "live",
				placeholder: "C:\\ffmpeg\\bin\\ffmpeg.exe",
				help: "Để trống để dùng ffmpeg-static đi kèm.",
			},
			{ key: "NGROK_AUTHTOKEN", label: "ngrok authtoken", type: "secret", testable: "format" },
			{ key: "CloudflaredToken", label: "Cloudflare tunnel token", type: "secret", testable: "format" },
		],
	},
];

const KNOWN_KEYS = new Set(ENV_SCHEMA.flatMap((group) => group.fields.map((field) => field.key)));
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_VALUE_LENGTH = 8192;

/* ------------------------------------------------------------------ */
/* .env parsing / editing                                              */
/* ------------------------------------------------------------------ */

// Same grammar as dotenv, plus the `d` flag so we know where each value sits in the file.
const createLineRegex = () =>
	/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/dgm;

const unquote = (raw) => {
	let value = String(raw ?? "").trim();
	const quote = value[0];
	value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
	if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
	return value;
};

/** Parse .env content into a plain object (last occurrence wins, like dotenv). */
const parseEnv = (content = "") => {
	const values = Object.create(null);
	const text = String(content).replace(/\r\n?/g, "\n");
	for (const match of text.matchAll(createLineRegex())) {
		if (FORBIDDEN_KEYS.has(match[1])) continue;
		values[match[1]] = unquote(match[2]);
	}
	return values;
};

/**
 * Pick a quote style that dotenv reads back to exactly the same value.
 * dotenv does not unescape \" so a value that contains " must use ' or `.
 */
const formatEnvValue = (value) => {
	const text = String(value ?? "");
	if (/[\r\n\0]/.test(text)) throw new Error("Giá trị không được chứa xuống dòng.");
	const needsLiteral = text.includes('"') || /\\[nr]/.test(text);
	if (!needsLiteral) return `"${text}"`;
	if (!text.includes("'")) return `'${text}'`;
	if (!text.includes("`")) return `\`${text}\``;
	throw new Error("Giá trị chứa đồng thời các ký tự ' \" và ` nên không thể lưu an toàn vào .env.");
};

/** Normalise the comma separated token list: trim, drop empty items and duplicates. */
const normalizeTokenList = (value) => {
	const seen = new Set();
	const tokens = [];
	for (const item of String(value ?? "").split(/[,\r\n]+/)) {
		const token = item
			.trim()
			.replace(/^["'`]|["'`]$/g, "")
			.trim();
		if (token && !seen.has(token)) {
			seen.add(token);
			tokens.push(token);
		}
	}
	return tokens;
};

const validateChanges = ({ values = {}, remove = [] } = {}) => {
	if (values === null || typeof values !== "object" || Array.isArray(values)) throw new Error("`values` phải là object.");
	if (!Array.isArray(remove)) throw new Error("`remove` phải là mảng.");

	const cleanValues = Object.create(null);
	for (const [key, rawValue] of Object.entries(values)) {
		if (!KEY_PATTERN.test(key) || FORBIDDEN_KEYS.has(key)) throw new Error(`Tên biến không hợp lệ: ${key}`);
		if (typeof rawValue !== "string") throw new Error(`Giá trị của ${key} phải là chuỗi.`);
		let value = rawValue.trim();
		if (key === "MULTI_PLAYER_TOKEN") value = normalizeTokenList(value).join(",");
		if (value.length > MAX_VALUE_LENGTH) throw new Error(`Giá trị của ${key} quá dài.`);
		formatEnvValue(value); // throws when the value cannot be stored safely
		cleanValues[key] = value;
	}

	const cleanRemove = [];
	for (const key of remove) {
		if (typeof key !== "string" || !KEY_PATTERN.test(key) || FORBIDDEN_KEYS.has(key)) {
			throw new Error(`Tên biến không hợp lệ: ${String(key)}`);
		}
		if (KNOWN_KEYS.has(key)) throw new Error(`Không thể xóa biến hệ thống ${key}. Hãy để trống giá trị.`);
		cleanRemove.push(key);
	}
	return { values: cleanValues, remove: cleanRemove };
};

/**
 * Apply changes to existing .env text. Comments, blank lines, unknown keys and inline comments are kept.
 * Existing keys are edited in place; new non-empty keys are appended at the end.
 */
const applyEnvChanges = (content, changes) => {
	const { values, remove } = validateChanges(changes);
	const hasCrlf = /\r\n/.test(content || "");
	let text = String(content || "").replace(/\r\n?/g, "\n");

	const edits = [];
	const seen = new Set();
	for (const match of text.matchAll(createLineRegex())) {
		const key = match[1];
		const keyStart = match.indices[1][0];
		const lineStart = text.lastIndexOf("\n", keyStart - 1) + 1;
		const matchEnd = match.index + match[0].length;
		const lineEnd = text[matchEnd] === "\n" ? matchEnd + 1 : matchEnd;

		if (remove.includes(key)) {
			edits.push({ start: lineStart, end: lineEnd, text: "" });
			seen.add(key);
			continue;
		}
		if (!(key in values)) continue;
		seen.add(key);

		const formatted = formatEnvValue(values[key]);
		if (match.indices[2]) {
			const [groupStart, groupEnd] = match.indices[2];
			const raw = text.slice(groupStart, groupEnd);
			const lead = raw.match(/^\s*/)[0].length;
			const trail = raw.trim() ? raw.match(/\s*$/)[0].length : 0;
			edits.push({
				start: groupStart + (raw.trim() ? lead : 0),
				end: groupEnd - trail,
				text: formatted,
			});
		} else {
			const equals = text.indexOf("=", match.indices[1][1]);
			if (equals === -1 || equals >= matchEnd) {
				seen.delete(key); // `KEY: value` style without a value: append a normal line instead
				continue;
			}
			edits.push({ start: equals + 1, end: equals + 1, text: ` ${formatted}` });
		}
	}

	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
	}

	const additions = Object.entries(values)
		.filter(([key, value]) => !seen.has(key) && value !== "")
		.map(([key, value]) => `${key} = ${formatEnvValue(value)}`);
	if (additions.length) {
		if (text && !text.endsWith("\n")) text += "\n";
		text += `${additions.join("\n")}\n`;
	}

	return hasCrlf ? text.replace(/\n/g, "\r\n") : text;
};

/* ------------------------------------------------------------------ */
/* Testing values before they are saved                                */
/* ------------------------------------------------------------------ */

const ok = (message, extra = {}) => ({ ok: true, level: "ok", message, ...extra });
const warn = (message, extra = {}) => ({ ok: true, level: "warn", message, ...extra });
const fail = (message, extra = {}) => ({ ok: false, level: "error", message, ...extra });

const NETWORK_TIMEOUT = 10_000;

const describeNetworkError = (error) => {
	if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Hết thời gian chờ, không kết nối được.";
	const code = error?.cause?.code || error?.code;
	return code ? `Không kết nối được (${code}).` : "Không kết nối được.";
};

const cleanDiscordToken = (value) =>
	String(value ?? "")
		.trim()
		.replace(/^["'`]|["'`]$/g, "")
		.replace(/^Bot\s+/i, "")
		.trim();

const DISCORD_TOKEN_PATTERN = /^[\w-]{5,}\.[\w-]{4,}\.[\w-]{10,}$/;

const INTENT_FLAGS = {
	members: { full: 1 << 14, limited: 1 << 15, label: "Server Members Intent" },
	content: { full: 1 << 18, limited: 1 << 19, label: "Message Content Intent" },
};

const avatarOf = (user) =>
	user.avatar ?
		`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
	:	`https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;

/** Ask Discord who owns the token using REST only (no gateway connection is opened). */
const testDiscordToken = async (value, { checkIntents = false } = {}) => {
	const token = cleanDiscordToken(value);
	if (!token) return fail("Token đang trống.");
	if (!DISCORD_TOKEN_PATTERN.test(token)) return fail("Sai định dạng token (cần dạng xxxx.yyyy.zzzz).");

	const { REST, Routes } = require("discord.js");
	const rest = new REST({ version: "10", timeout: NETWORK_TIMEOUT, retries: 0 }).setToken(token);

	let user;
	try {
		user = await rest.get(Routes.user());
	} catch (error) {
		if (error?.status === 401) return fail("Token không hợp lệ hoặc đã bị reset.");
		if (error?.status === 429) return fail("Discord đang giới hạn tốc độ (429). Chờ một chút rồi thử lại.");
		return fail(error?.status ? `Discord trả về lỗi ${error.status}.` : describeNetworkError(error));
	}

	const bot = {
		id: user.id,
		name: user.global_name || user.username,
		tag: user.discriminator && user.discriminator !== "0" ? `${user.username}#${user.discriminator}` : user.username,
		avatar: avatarOf(user),
		isBot: !!user.bot,
	};
	if (!bot.isBot) return fail("Token này thuộc tài khoản người dùng, không phải bot.", { bot });

	const warnings = [];
	if (checkIntents) {
		try {
			const application = await rest.get(Routes.currentApplication());
			const flags = Number(application?.flags || 0);
			for (const intent of Object.values(INTENT_FLAGS)) {
				if (!(flags & intent.full) && !(flags & intent.limited)) warnings.push(`Chưa bật ${intent.label}`);
			}
			bot.applicationId = application?.id;
		} catch {
			// Intent info is a bonus; the token itself is already confirmed.
		}
	}

	const message = `Token hợp lệ: ${bot.name} (${bot.id})`;
	return warnings.length ?
			warn(`${message}. Cảnh báo: ${warnings.join(", ")} trong Developer Portal → Bot → Privileged Gateway Intents.`, { bot })
		:	ok(message, { bot });
};

const testDiscordClientSecret = async (value, context = {}, client) => {
	const secret = String(value ?? "").trim();
	if (!secret) return fail("Client secret đang trống.");
	if (/\s/.test(secret) || secret.length < 20) return fail("Client secret có vẻ sai định dạng.");

	let applicationId = client?.application?.id || client?.user?.id;
	const mainToken = cleanDiscordToken(context?.TOKEN);
	if (mainToken && DISCORD_TOKEN_PATTERN.test(mainToken)) {
		const { REST, Routes } = require("discord.js");
		try {
			const rest = new REST({ version: "10", timeout: NETWORK_TIMEOUT, retries: 0 }).setToken(mainToken);
			applicationId = (await rest.get(Routes.currentApplication())).id;
		} catch {}
	}
	if (!applicationId) return warn("Chưa có TOKEN hợp lệ để biết Application ID nên chỉ kiểm tra được định dạng.");

	try {
		const response = await fetch("https://discord.com/api/v10/oauth2/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(`${applicationId}:${secret}`).toString("base64")}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }),
			signal: AbortSignal.timeout(NETWORK_TIMEOUT),
		});
		if (response.ok) return ok("Client secret hợp lệ.");
		if (response.status === 401 || response.status === 400) return fail("Client secret không khớp với ứng dụng này.");
		return fail(`Discord trả về lỗi ${response.status}.`);
	} catch (error) {
		return fail(describeNetworkError(error));
	}
};

const testMongo = async (value) => {
	const uri = String(value ?? "").trim();
	if (!uri) return warn("Để trống: bot sẽ dùng SQLite.");

	let normalized;
	let usedAppName = false;
	try {
		const { _internals } = require("../startup/prismaDB");
		normalized = _internals.normalizeMongoUrl(uri);
		usedAppName = !decodeURIComponent(new URL(uri).pathname.replace(/^\//, "")).trim();
	} catch (error) {
		return fail(error.message);
	}

	let client;
	try {
		const { MongoClient } = require("mongoose").mongo;
		client = new MongoClient(normalized, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, appName: "ziji-config-test" });
		await client.connect();
		const db = client.db();
		await db.command({ ping: 1 });
		let replicaSet = true;
		try {
			const hello = await db.admin().command({ hello: 1 });
			replicaSet = !!hello.setName;
		} catch {}

		const notes = [];
		if (usedAppName) notes.push("URI chưa có tên database, bot sẽ dùng appName làm tên database");
		if (!replicaSet) notes.push("máy chủ không chạy replica set — Prisma thường yêu cầu replica set cho MongoDB");
		const message = `Kết nối MongoDB thành công (database: ${db.databaseName})`;
		return notes.length ? warn(`${message}. Lưu ý: ${notes.join("; ")}.`) : ok(`${message}.`);
	} catch (error) {
		const raw = String(error?.message || error);
		const safe = raw.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "mongodb://***");
		if (/auth/i.test(raw)) return fail("Sai tài khoản hoặc mật khẩu MongoDB.");
		return fail(`Không kết nối được MongoDB: ${safe.slice(0, 200)}`);
	} finally {
		await client?.close().catch(() => {});
	}
};

const testSqlite = async (value) => {
	const raw = String(value ?? "").trim();
	if (!raw) return warn("Để trống: bot dùng mặc định file:./jsons/ziDB.sqlite.");
	if (!/^file:/i.test(raw)) return fail('SQLite URL phải bắt đầu bằng "file:" (ví dụ file:./jsons/ziDB.sqlite).');

	const filePath = raw.replace(/^file:/i, "").split("?")[0];
	if (!filePath) return fail("Thiếu đường dẫn file sau file:.");
	const resolved = path.resolve(process.cwd(), filePath);

	if (fs.existsSync(resolved)) {
		try {
			await fs.promises.access(resolved, fs.constants.R_OK | fs.constants.W_OK);
			return ok(`File đã tồn tại và ghi được: ${resolved}`);
		} catch {
			return fail(`Không có quyền đọc/ghi file: ${resolved}`);
		}
	}

	let dir = path.dirname(resolved);
	while (!fs.existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
	try {
		await fs.promises.access(dir, fs.constants.W_OK);
		return ok(`File chưa có, sẽ được tạo tại: ${resolved}`);
	} catch {
		return fail(`Không có quyền ghi vào thư mục: ${dir}`);
	}
};

const testGemini = async (value) => {
	const key = String(value ?? "").trim();
	if (!key) return warn("Để trống: tính năng AI sẽ không hoạt động.");
	try {
		const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
			headers: { "x-goog-api-key": key },
			signal: AbortSignal.timeout(NETWORK_TIMEOUT),
		});
		if (response.ok) return ok("Gemini API key hợp lệ.");
		if ([400, 401, 403].includes(response.status)) return fail("Gemini API key không hợp lệ hoặc chưa được cấp quyền.");
		return fail(`Google trả về lỗi ${response.status}.`);
	} catch (error) {
		return fail(describeNetworkError(error));
	}
};

const testWeather = async (value) => {
	const key = String(value ?? "").trim();
	if (!key) return warn("Để trống: lệnh thời tiết sẽ không hoạt động.");
	try {
		const url = new URL("https://api.openweathermap.org/data/2.5/weather");
		url.search = new URLSearchParams({ q: "Hanoi", appid: key }).toString();
		const response = await fetch(url, { signal: AbortSignal.timeout(NETWORK_TIMEOUT) });
		if (response.ok) return ok("OpenWeather API key hợp lệ.");
		if (response.status === 401) return fail("Key không hợp lệ (key mới tạo có thể cần vài phút để kích hoạt).");
		if (response.status === 429) return warn("Key hợp lệ nhưng đã vượt giới hạn gọi API.");
		return fail(`OpenWeather trả về lỗi ${response.status}.`);
	} catch (error) {
		return fail(describeNetworkError(error));
	}
};

const testOcr = (value) => {
	const key = String(value ?? "").trim();
	if (!key) return warn("Để trống: tính năng OCR sẽ không hoạt động.");
	if (/\s/.test(key) || key.length < 8) return fail("Key có vẻ sai định dạng.");
	return ok("Định dạng hợp lệ (không gọi API để tránh tốn quota).");
};

const testUrl = async (value, label) => {
	const raw = String(value ?? "").trim();
	if (!raw) return warn("Để trống.");
	let url;
	try {
		url = new URL(raw);
	} catch {
		return fail("URL không hợp lệ.");
	}
	if (!["http:", "https:"].includes(url.protocol)) return fail("URL phải bắt đầu bằng http:// hoặc https://.");
	try {
		const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000) });
		await response.body?.cancel?.().catch(() => {});
		return ok(`${label} truy cập được (HTTP ${response.status}).`);
	} catch (error) {
		return fail(`${label}: ${describeNetworkError(error)}`);
	}
};

const testPort = (value) => {
	const raw = String(value ?? "").trim();
	if (!raw) return warn("Để trống: dùng port mặc định 2003.");
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) return fail("Port phải là số nguyên từ 1 đến 65535.");
	if (port < 1024) return warn("Port dưới 1024 thường cần quyền quản trị. Đổi port cần khởi động lại bot.");
	return ok("Port hợp lệ. Đổi port cần khởi động lại bot.");
};

const testCors = (value) => {
	const raw = String(value ?? "").trim();
	if (!raw) return warn("Để trống.");
	const origins = raw
		.split(",")
		.map((item) => item.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
	if (!origins.length) return fail("Không có origin nào.");
	for (const origin of origins) {
		if (origin === "*") continue;
		try {
			const url = new URL(origin);
			if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
		} catch {
			return fail(`Origin không hợp lệ: ${origin}`);
		}
	}
	return origins.includes("*") && origins.length > 1 ?
			warn('"*" đã cho phép mọi origin nên các origin còn lại là thừa.')
		:	ok(origins.includes("*") ? "Cho phép mọi origin." : `${origins.length} origin hợp lệ.`);
};

const testJwtSecret = (value) => {
	const secret = String(value ?? "");
	if (!secret) return warn("Để trống: dashboard có thể không đăng nhập được.");
	if (secret === "your_jwt_secret") return warn("Đang dùng giá trị mẫu, hãy tạo chuỗi ngẫu nhiên.");
	if (secret.length < 16) return warn("Nên dài ít nhất 16 ký tự.");
	return ok("JWT secret đủ dài.");
};

const testFfmpeg = async (value) => {
	const raw = String(value ?? "").trim();
	if (!raw) return ok("Để trống: dùng ffmpeg-static đi kèm.");
	let stat;
	try {
		stat = await fs.promises.stat(raw);
	} catch {
		return fail("Không tìm thấy file tại đường dẫn này.");
	}
	if (!stat.isFile()) return fail("Đường dẫn này không phải file.");
	return new Promise((resolve) => {
		execFile(raw, ["-version"], { timeout: 5000, windowsHide: true }, (error, stdout) => {
			if (error) return resolve(fail("Không chạy được file này với tham số -version."));
			const firstLine = String(stdout).split("\n")[0].trim();
			resolve(/ffmpeg/i.test(firstLine) ? ok(firstLine.slice(0, 120)) : fail("File này không phải ffmpeg."));
		});
	});
};

const testNgrok = (value) => {
	const token = String(value ?? "").trim();
	if (!token) return warn("Để trống: không dùng ngrok.");
	if (/\s/.test(token) || token.length < 20) return fail("Token có vẻ sai định dạng.");
	return ok("Định dạng hợp lệ (ngrok không có API kiểm tra nhanh).");
};

const testCloudflared = (value) => {
	const token = String(value ?? "").trim();
	if (!token) return warn("Để trống: không dùng Cloudflare tunnel.");
	try {
		const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
		if (decoded?.a && decoded?.t && decoded?.s) return ok(`Tunnel token hợp lệ (tunnel ${decoded.t}).`);
	} catch {}
	return fail("Không đọc được tunnel token (cần chuỗi base64 do Cloudflare cấp).");
};

/**
 * Test a single value without saving it.
 * @param {string} key  env variable name
 * @param {string} value value to test
 * @param {{ context?: Record<string,string>, client?: import("discord.js").Client }} [options]
 */
const testEnvValue = async (key, value, { context = {}, client } = {}) => {
	switch (key) {
		case "TOKEN":
			return testDiscordToken(value, { checkIntents: true });
		case "MULTI_PLAYER_TOKEN":
			return testDiscordToken(value);
		case "DISCORD_CLIENT_SECRET":
			return testDiscordClientSecret(value, context, client);
		case "MONGO":
			return testMongo(value);
		case "SQLITE_DATABASE_URL":
			return testSqlite(value);
		case "GEMINI_API_KEY":
			return testGemini(value);
		case "WEATHER_API_KEY":
			return testWeather(value);
		case "OCR_API_KEY":
			return testOcr(value);
		case "DASHBOARD_URL":
			return testUrl(value, "Dashboard");
		case "API_URL":
			return testUrl(value, "API");
		case "SERVER_PORT":
			return testPort(value);
		case "CORS":
			return testCors(value);
		case "JWT_SECRET":
			return testJwtSecret(value);
		case "FFMPEG_PATH":
			return testFfmpeg(value);
		case "NGROK_AUTHTOKEN":
			return testNgrok(value);
		case "CloudflaredToken":
			return testCloudflared(value);
		default:
			return null;
	}
};

module.exports = {
	ENV_SCHEMA,
	KNOWN_KEYS,
	parseEnv,
	applyEnvChanges,
	formatEnvValue,
	normalizeTokenList,
	validateChanges,
	cleanDiscordToken,
	testEnvValue,
	testDiscordToken,
};
