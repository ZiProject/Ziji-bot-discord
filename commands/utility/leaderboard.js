const { useHooks } = require("zihooks");
const { createImageStudioAttachment } = require("../../utility/imageStudio");

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

	const leaderboardEntries = [];
	let rankNum = 1;
	for (const members of usersort) {
		const member = await interaction.client.users.fetch(members.userID);
		const avatar = member.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" });
		leaderboardEntries.push({
			rank: rankNum,
			username: member.displayName || member.username,
			handle: `@${member.username}`,
			avatar,
			level: members.level ?? 0,
			xp: members.xp ?? 0,
		});
		rankNum++;
	}

	const attachment = await createImageStudioAttachment(
		{
			type: "leaderboard",
			data: {
				guildIcon:
					interaction.guild?.iconURL({ size: 1024, extension: "png" }) ||
					interaction.client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				items: leaderboardEntries.slice(0, 10),
			},
		},
		"leaderboard.png",
	);

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
