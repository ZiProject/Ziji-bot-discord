const { AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { Worker } = require("worker_threads");

async function buildImageInWorker(workerData) {
	return new Promise((resolve, reject) => {
		const worker = new Worker("./utility/LeaderboardCard.js", {
			workerData,
		});

		worker.on("message", (arrayBuffer) => {
			try {
				const buffer = Buffer.from(arrayBuffer);
				if (!Buffer.isBuffer(buffer)) {
					throw new Error("Received data is not a buffer");
				}
				const attachment = new AttachmentBuilder(buffer, { name: "Leaderboard.png" });
				resolve(attachment);
			} catch (error) {
				reject(error);
			} finally {
				worker.postMessage("terminate");
			}
		});

		worker.on("error", reject);

		worker.on("exit", (code) => {
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
}

module.exports.data = {
	name: "leaderboard",
	description: "View leaderboard.",

	options: [],
	integration_types: [0],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const db = useHooks.get("db");
	if (!db) return interaction.editReply({ content: lang?.until?.noDB, ephemeral: true }).catch(() => {});

	const UserI = await db?.ZiUser?.find();

	const usersort = UserI.sort((a, b) => {
		if (b.level !== a.level) {
			return b.level - a.level;
		}
		return b.xp - a.xp;
	})
		.filter((user) => !!user.userID)
		.slice(0, 15);

	// Leaderboard name and entry array
	const leaderboardEntries = [];
	let rankNum = 1;
	// Build leaderboard entries
	for (const members of usersort) {
		const member = await interaction.client.users.fetch(members.userID);
		const avatar = member.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" });
		const username = "xxxxx" + member.username.slice(-4);
		const displayName = member.displayName;
		const level = members.level;
		const xp = members.xp;
		const rank = rankNum;

		leaderboardEntries.push({ avatar, username, displayName, level, xp, rank });
		rankNum++;
	}

	const totalMembers = interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

	const Leaderboard_data = {
		Header: {
			title: `${interaction.client.user.username} Leaderboard`,
			image: interaction.client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
			subtitle: `${totalMembers} members`,
		},
		Players: leaderboardEntries.slice(0, 10),
	};

	const attachment = await buildImageInWorker({ Leaderboard_data });

	const response = { content: "", files: [attachment], components: [] };
	if (!interaction.guild) response.components = [];

	if (!interaction.isButton()) {
		interaction.editReply(response).catch(() => {
			interaction?.channel?.send(response);
		});
	} else {
		interaction.message.edit(response).catch(console.error);
		interaction.deleteReply();
	}
};
