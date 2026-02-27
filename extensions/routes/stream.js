const express = require("express");
const router = express.Router();

const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");


class CacheManager {
	constructor(dir, ttl = 30 * 60 * 1000) {
		this.dir = dir;
		this.ttl = ttl;
		this.map = new Map(); // id -> { path, lastAccess, ref }

		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

		this.startGC();
	}

	touch(id, path) {
		const entry = this.map.get(id) || { path, ref: 0 };
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

	startGC() {
		setInterval(
			() => {
				const now = Date.now();

				for (const [id, info] of this.map.entries()) {
					if (info.ref > 0) continue; // đang stream

					if (now - info.lastAccess > this.ttl) {
						try {
							fs.unlinkSync(info.path);
							this.map.delete(id);
							console.log("[Cache] GC deleted:", id);
						} catch {}
					}
				}
			},
			5 * 60 * 1000,
		);
	}
}

const cacheManager = new CacheManager(path.join(process.cwd(), "cache"));

router.get("/play", async (req, res) => {
	let trackData;

	try {
		trackData = JSON.parse(req.query.trackData);
	} catch {
		return res.sendStatus(400);
	}

	const filePath = path.join(cacheManager.dir, `${trackData.id}.webm`);

	cacheManager.touch(trackData.id, filePath);

	if (!fs.existsSync(filePath)) {
		console.log("[Stream] Download:", trackData.title);

		const player = await getManager().create("webid");
		const stream = await player.save(trackData);

		await pipeline(stream, fs.createWriteStream(filePath));
	}

	const stat = fs.statSync(filePath);
	const range = req.headers.range;
	const fileSize = stat.size;

	cacheManager.lock(trackData.id);

	res.on("close", () => {
		cacheManager.unlock(trackData.id);
	});

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

		res.writeHead(206, {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": end - start + 1,
			"Content-Type": "audio/webm",
			"Access-Control-Allow-Origin": "*",
		});

		fs.createReadStream(filePath, { start, end }).pipe(res);
	} else {
		res.writeHead(200, {
			"Content-Length": fileSize,
			"Content-Type": "audio/webm",
			"Accept-Ranges": "bytes",
			"Access-Control-Allow-Origin": "*",
		});

		fs.createReadStream(filePath).pipe(res);
	}
});

const deleteCacheFile = async (fileName) => {
	const cacheDir = path.join(process.cwd(), "cache");
	const filePath = path.join(cacheDir, fileName);

	try {
		await fs.unlink(filePath);
		console.log(`[Cache] Deleted: ${fileName}`);
	} catch (error) {
		console.error("Delete failed:", error.message);
	}
};

module.exports.data = {
	name: "streamRoutes",
	description: "Stream route for serving audio streams",
	version: "1.0.0",
	enable: true,
};
module.exports.execute = () => {
	deleteCacheFile();
	const server = useHooks.get("server");
	server.use("/api/stream", router);
	return;
};
