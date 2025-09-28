/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { parentPort, workerData } = require("worker_threads");
const { RankCardBuilder, Font } = require("canvacord");

async function buildImage(rankCard_data) {
	const { member, userDB, sss, strimg, status, colorr, avtaURL } = rankCard_data;
	const coinValue = userDB._doc?.coin || 0;
	const coinText = coinValue < 0 ? `bạn nợ ngân hàng ${Math.abs(coinValue)} xu` : `${coinValue} xu`;
	Font.loadDefault();
	const rankCard = new RankCardBuilder()
		.setAvatar(avtaURL)
		.setUsername(coinText)
		.setCurrentXP(userDB._doc?.xp || 0)
		.setLevel(userDB._doc?.level || 1)
		.setRequiredXP((userDB._doc?.level || 1) * 50 + 1)
		.setProgressCalculator(() => Math.floor(((userDB._doc?.xp || 0) / ((userDB._doc?.level || 1) * 50 + 1)) * 100))
		.setStatus(status)
		.setDisplayName(member?.tag || member?.nickname || member?.user?.tag, colorr)
		.setBackground(strimg)
		.setRank(sss + 1)
		.setOverlay(15.5)
		.setStyles({
			progressbar: {
				thumb: {
					style: {
						backgroundColor: colorr,
					},
				},
			},
			username: {
				name: {
					style: {
						color: colorr,
					},
				},
			},
			statistics: {
				level: {
					text: {
						style: {
							color: colorr,
						},
					},
					value: {
						style: {
							color: colorr,
						},
					},
				},
				xp: {
					text: {
						style: {
							color: colorr,
						},
					},
					value: {
						style: {
							color: colorr,
						},
					},
				},
				rank: {
					text: {
						style: {
							color: colorr,
						},
					},
					value: {
						style: {
							color: colorr,
						},
					},
				},
			},
		});

	const buffer = await rankCard.build({ format: "png" });
	parentPort.postMessage(buffer.buffer); // Send as ArrayBuffer
}

// Listen for termination signal
parentPort.on("message", (message) => {
	if (message === "terminate") {
		process.exit(0); // Gracefully exit
	}
});

buildImage(workerData.rankCard_data).catch((error) => {
	console.error("Error in worker:", error);
	process.exit(1);
});
