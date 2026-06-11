const { parentPort, workerData } = require("worker_threads");
const { RankCardBuilder, Font } = require("canvacord");

async function buildImage(rankCard_data) {
	const { member, userDB, sss, strimg, status, colorr, avtaURL } = rankCard_data;
	const doc = userDB?._doc ?? userDB ?? {};
	const coinValue = doc.coin ?? 0;
	const coinText = coinValue < 0 ? `bạn nợ ngân hàng ${Math.abs(coinValue)} xu` : `${coinValue} xu`;
	const xp = doc.xp ?? 0;
	const level = doc.level ?? 1;
	Font.loadDefault();
	const rankCard = new RankCardBuilder()
		.setAvatar(avtaURL)
		.setUsername(coinText)
		.setCurrentXP(xp)
		.setLevel(level)
		.setRequiredXP(level * 50 + 1)
		.setProgressCalculator(() => Math.floor((xp / (level * 50 + 1)) * 100))
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
