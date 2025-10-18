const cron = require("node-cron");
const { useDB, useLogger } = require("@zibot/zihooks");
const { claimGenshinDaily } = require("../utils/hoyolab");

class HoyoAutoClaimer {
	constructor() {
		this.job = null;
		this.running = false;
	}

	start(client) {
		if (this.job) return;
		const log = useLogger();
		// Run daily at 00:05 local time
		this.job = cron.schedule("5 0 * * *", async () => {
			if (this.running) return;
			this.running = true;
			try {
				const db = useDB();
				if (!db?.ZiUser) return;

				const allUsers = (await db.ZiUser.find()) || [];
				const targets = allUsers.filter((u) => u?.genshinAutoClaim && u?.hoyoCookie);
				for (const u of targets) {
					try {
						const res = await claimGenshinDaily(u.hoyoCookie);
						if (res.status === "claimed") {
							await db.ZiUser.findOneAndUpdate(
								{ userID: u.userID },
								{ $set: { lastGenshinClaim: new Date() } },
								{ upsert: true },
							);
						}

						// Notify via DM (best-effort)
						if (client && u.userID) {
							try {
								const user = await client.users.fetch(u.userID).catch(() => null);
								if (user) {
									const statusText =
										res.status === "claimed" ? `✅ Đã nhận daily thành công${res.rewardName ? `: ${res.rewardName}` : ""}.`
										: res.status === "already" ? `ℹ️ Hôm nay bạn đã nhận rồi.`
										: `⚠️ Nhận daily thất bại: ${res.message || "Unknown"}`;
									await user.send(`Genshin Daily • ${statusText}`).catch(() => {});
								}
							} catch {}
						}
					} catch (e) {
						log?.error?.("AutoClaim error for user", u?.userID, e?.message);
					}
				}
			} catch (err) {
				useLogger()?.error?.("HoyoAutoClaimer job error:", err);
			} finally {
				this.running = false;
			}
		});

		this.job.start();
		log?.info?.("HoyoAutoClaimer scheduled (00:05 daily)");
	}
}

module.exports = { HoyoAutoClaimer };
