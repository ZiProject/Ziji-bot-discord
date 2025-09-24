const { lyricsExt } = require("@ziplayer/extension");
const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "lyrics",
	description: "Lời bài hát",
	type: 1, // slash commad
	options: [
		{
			name: "query",
			description: "Tên bài hát",
			type: 3,
			required: true,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { options, user } = interaction;

	const lyric = new lyricsExt();

	await interaction.deferReply();
	const query = await options.getString("query");
	const lyricsRes = await lyric.fetch({ title: query });

	if (!lyricsRes?.text)
		return interaction.editReply({
			embeds: [new EmbedBuilder().setColor("Red").setDescription(`${lang?.Lyrics?.no_res ?? "❌ | No Lyrics Found!"}`)],
		});

	const embed = new EmbedBuilder()
		.setColor("Random")
		.setTimestamp()
		.setFooter({
			text: `by: ${user?.username}`,
			iconURL: user?.displayAvatarURL?.({ size: 1024 }) ?? null,
		})
		.setDescription(lyricsRes.text.slice(0, 1990) + (lyricsRes.text.length > 1990 ? "..." : ""))
		.setTitle("Lyrics: " + lyricsRes?.trackName);

	await interaction.editReply({ embeds: [embed] });
	return;
};
