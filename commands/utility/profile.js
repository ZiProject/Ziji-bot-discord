const { ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { Worker } = require("worker_threads");

async function buildImageInWorker(workerData) {
	return new Promise((resolve, reject) => {
		const worker = new Worker("./utility/rankcad.js", {
			workerData,
		});

		worker.on("message", (arrayBuffer) => {
			try {
				const buffer = Buffer.from(arrayBuffer);
				if (!Buffer.isBuffer(buffer)) {
					throw new Error("Received data is not a buffer");
				}
				const attachment = new AttachmentBuilder(buffer, { name: "rank.png" });
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
	name: "profile",
	description: "View profile.",
	description_localizations: {
		"en-US": "View profile.",
		vi: "Xem thông tin hồ sơ của bạn.",
		ja: "プロフィールを見る",
		ko: "프로필 보기",
	},
	options: [
		{
			name: "user",
			description: "Rank of user.",
			type: 6,
			required: false,
			description_localizations: {
				"en-US": "Select user",
				vi: "Chọn người dùng",
				ja: "ユーザーを選択",
				ko: "사용자 선택",
			},
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const targetUser = interaction?.options?.getUser("user") || interaction.user;

	const member = (await interaction?.guild?.members.fetch(targetUser)) || interaction.user;

	const db = useHooks.get("db");
	if (!db) return interaction.editReply({ content: lang?.until?.noDB, ephemeral: true }).catch(() => {});

	const [userDB, UserI] = await Promise.all([db.ZiUser.findOne({ userID: member.id }), db.ZiUser.find()]);

	const usersort = UserI.sort((a, b) => {
		if (b.lvl !== a.lvl) {
			return b.lvl - a.lvl;
		}
		return b.Xp - a.Xp;
	});

	const sss = usersort.findIndex((user) => user.userID === member.id);

	const strimg = useHooks.get("config").botConfig?.rankBackground || "https://i.imgur.com/sVzFJ8W.jpeg";

	const editProf = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setLabel("Edit ✎").setCustomId("B_editProfile").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setLabel("↻").setCustomId("B_refProfile").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setEmoji("<:leaderboard:1154355691063087195>")
			.setCustomId("B_refLeaderboard")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setLabel("❌").setCustomId("cancel").setStyle(ButtonStyle.Secondary),
	);

	const status = member.presence?.status || "none";
	const colorr = lang?.color || "#ffffff";

	const rankCard_data = {
		member: {
			tag: member.user.tag,
			nickname: member.nickname,
			user: {
				tag: member.user.tag,
				displayAvatarURL: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
			},
		},
		userDB: {
			_doc: {
				coin: userDB._doc?.coin || 0,
				xp: userDB._doc?.xp || 0,
				level: userDB._doc?.level || 1,
			},
		},
		sss,
		strimg,
		status,
		colorr,
		avtaURL: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
	};

	const attachment = await buildImageInWorker({ rankCard_data });

	const response = { content: "", files: [attachment], components: [editProf] };
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
