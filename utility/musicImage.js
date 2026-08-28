const { MusicSearchCard } = require("./MusicSearchCard");

async function buildImage(searchPlayer, query) {
	const card = new MusicSearchCard().setPlayers(searchPlayer).setTitle(query);
	return card.build({ format: "png" });
}

// This file is intentionally executed with child_process.fork().
// Keeping the renderer in a separate OS process prevents native image
// rendering failures from taking down the Discord bot process.
if (typeof process.send === "function") {
	process.once("message", async ({ searchPlayer, query }) => {
		try {
			const buffer = await buildImage(searchPlayer, query);
			process.send({ type: "result", data: buffer.toString("base64") }, () => {
				if (process.connected) process.disconnect();
			});
		} catch (error) {
			const message = error instanceof Error ? error.stack || error.message : String(error);
			if (process.connected) {
				process.send({ type: "error", error: message }, () => {
					process.disconnect();
					process.exitCode = 1;
				});
			} else {
				process.exitCode = 1;
			}
		}
	});
}
