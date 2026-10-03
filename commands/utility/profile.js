const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const { useHooks } = require("zihooks");
const { createImageStudioAttachment } = require("../../utility/imageStudio");

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
		{
			name: "theme",
			description: "Choose the rank card theme",
			type: 3,
			required: false,
			choices: [
				{ name: "Ruby Poly", value: "ruby-poly" },
				{ name: "Cyber Neon", value: "cyber-neon" },
				{ name: "Glass Minimal", value: "glass-minimal" },
				{ name: "Gold Legend", value: "gold-legend" },
			],
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

	const usersort = [...UserI].sort((a, b) => {
		const levelDiff = (b.level ?? 0) - (a.level ?? 0);
		if (levelDiff !== 0) return levelDiff;
		return (b.xp ?? 0) - (a.xp ?? 0);
	});

	const sss = usersort.findIndex((user) => user.userID === member.id);
	const profileUser = member.user || member;
	const userLevel = userDB?.level ?? userDB?._doc?.level ?? 1;
	const userXp = userDB?.xp ?? userDB?._doc?.xp ?? 0;
	const coinValue = userDB?.coin ?? userDB?._doc?.coin ?? 0;
	const balance = coinValue < 0 ? `bạn nợ ngân hàng ${Math.abs(coinValue)} xu` : `${coinValue} xu`;
	const theme = interaction.isButton() ? "ruby-poly" : interaction.options.getString("theme") || "ruby-poly";

	const editProf = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setLabel("Edit ✎").setCustomId("B_editProfile").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setLabel("↻").setCustomId("B_refProfile").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setEmoji("<:leaderboard:1154355691063087195>")
			.setCustomId("B_refLeaderboard")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setLabel("❌").setCustomId("B_cancel").setStyle(ButtonStyle.Secondary),
	);

	const attachment = await createImageStudioAttachment(
		{
			type: "profile",
			data: {
				username: member.displayName || member.nickname || profileUser.displayName || profileUser.username,
				balance,
				avatar: profileUser.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				level: userLevel,
				currentXp: userXp,
				requiredXp: userLevel * 50 + 1,
				rank: `#${Math.max(sss + 1, 1)}`,
				theme,
			},
		},
		"rank.png",
	);

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
