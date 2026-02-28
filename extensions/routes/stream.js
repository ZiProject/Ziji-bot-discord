const express = require("express");
const router = express.Router();

const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const Logger = useHooks.get("logger");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

class CacheManager {
	constructor(dir, ttl = 30 * 60 * 1000) {
		this.dir = dir;
		this.ttl = ttl;
		this.map = new Map(); // id -> { path, lastAccess, ref, downloading }

		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

		this.startGC();
	}

	touch(id, path) {
		const entry = this.map.get(id) || { path, ref: 0, downloading: null };
		entry.lastAccess = Date.now();
		this.map.set(id, entry);
	}

	lock(id) {
		const entry = this.map.get(id);
		if (entry) entry.ref++;
	}

	unlock(id) {
		const entry = this.map.get(id);
		if (entry) entry.ref = Math.max(0, entry.ref - 1);
	}

	setDownloading(id, promise) {
		const entry = this.map.get(id);
		if (entry) entry.downloading = promise;
	}

	clearDownloading(id) {
		const entry = this.map.get(id);
		if (entry) entry.downloading = null;
	}

	startGC() {
		setInterval(
			() => {
				const now = Date.now();
				for (const [id, info] of this.map.entries()) {
					if (info.ref > 0 || info.downloading) continue;
					if (now - info.lastAccess > this.ttl) {
						try {
							fs.unlinkSync(info.path);
							this.map.delete(id);
							Logger.debug("[Cache] GC deleted:", id);
						} catch {}
					}
				}
			},
			5 * 60 * 1000,
		);
	}
}

const cacheManager = new CacheManager(path.join(process.cwd(), "cache"));

const waitForMinSize = async (file, minBytes = 256 * 1024, timeout = 8000) => {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (fs.existsSync(file)) {
			const size = fs.statSync(file).size;
			if (size >= minBytes) return size;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	throw new Error("Buffer timeout");
};

router.get("/play", async (req, res) => {
	let trackData;
	try {
		trackData = JSON.parse(req.query.trackData);
	} catch {
		return res.sendStatus(400);
	}

	const filePath = path.join(cacheManager.dir, `${trackData.id}.webm`);
	cacheManager.touch(trackData.id, filePath);
	cacheManager.lock(trackData.id);

	res.on("close", () => cacheManager.unlock(trackData.id));

	let entry = cacheManager.map.get(trackData.id);

	// Start download if not exists
	if (!fs.existsSync(filePath)) {
		if (!entry.downloading) {
			Logger.debug("[Stream] Download:", trackData.title);

			const startDownload = (async () => {
				try {
					const player = await getManager().create("webid");
					const stream = await player.save(trackData);

					await pipeline(stream, fs.createWriteStream(filePath));
				} catch (err) {
					Logger.error("[Stream] Download failed:", err);
				} finally {
					cacheManager.clearDownloading(trackData.id);
				}
			})();

			cacheManager.setDownloading(trackData.id, startDownload);
		}
	}

	try {
		const currentSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : await waitForMinSize(filePath, 256 * 1024);

		const range = req.headers.range || "bytes=0-";
		const parts = range.replace(/bytes=/, "").split("-");

		let start = parseInt(parts[0], 10) || 0;
		const MAX_FIRST_CHUNK = 1024 * 1024; // 1MB

		let end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + MAX_FIRST_CHUNK, currentSize - 1);

		res.writeHead(206, {
			"Content-Range": `bytes ${start}-${end}/*`,
			"Accept-Ranges": "bytes",
			"Content-Length": end - start + 1,
			"Content-Type": "audio/webm",
			"Access-Control-Allow-Origin": "*",
		});

		fs.createReadStream(filePath, { start, end }).pipe(res);
	} catch (err) {
		Logger.error("[Stream] Error:", err);
		res.sendStatus(500);
	}
});

module.exports.data = {
	name: "streamRoutes",
	description: "Hybrid progressive streaming route",
	version: "2.0.0",
	enable: true,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/api/stream", router);
	return;
};
