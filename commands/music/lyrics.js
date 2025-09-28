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
