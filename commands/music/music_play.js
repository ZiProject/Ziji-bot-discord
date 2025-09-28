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

const { getPlayer } = require("ziplayer");
const config = this.config;

module.exports.data = {
	name: "play",
	description: "Phát nhạc",
	type: 1, // slash commmand
	options: [
		{
			name: "next",
			description: "Thêm nhạc và tiếp theo",
			type: 1, // sub command
			options: [
				{
					name: "query",
					description: "Tên bài hát",
					required: true,
					type: 3,
					autocomplete: true,
				},
			],
		},
		{
			name: "music",
			description: "Phát nhạc",
			type: 1, // sub command
			options: [
				{
					name: "query",
					description: "Tên bài hát",
					required: true,
					type: 3,
					autocomplete: true,
				},
			],
		},
		{
			name: "assistant",
			description: "Thêm nhạc và điều khiển bằng giọng nói",
			type: 1, // sub command
			options: [
				{
					name: "query",
					description: "Tên bài hát",
					type: 3,
					autocomplete: true,
				},
				{
					name: "focus",
					description: "Chỉ nghe lệnh người yêu cầu.",
					type: 5, //BOOLEAN
				},
			],
		},
	],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const commandtype = interaction.options?.getSubcommand();
	const query = interaction.options?.getString("query");
	const command = this.functions?.get("Search");
	const player = getPlayer(interaction.guildId);
	if (commandtype === "next") {
		if (player.connection) {
			const res = await player.search(query, interaction.user);
			const track = res.tracks?.[0];

			if (track) {
				player.insert(track, 0, interaction.user);
				await interaction.reply({ content: lang.music.Next, ephemeral: true });
			} else {
				await interaction.reply({ content: lang.music.NOres, ephemeral: true });
			}
		} else {
			await command.execute(interaction, query, lang);
		}
	} else if (commandtype === "assistant") {
		const focus = interaction.options.getBoolean("focus") ? interaction.user.id : null;
		await command.execute(interaction, query, lang, { assistant: true, focus });
	} else {
		await command.execute(interaction, query, lang);
	}
	return;
};

/**
 * @param { object } autocomplete - object autocomplete
 * @param { import ("discord.js").AutocompleteInteraction } autocomplete.interaction - interaction
 * @param { import('../../lang/vi.js') } autocomplete.lang - language
 */

module.exports.autocomplete = async ({ interaction, lang }) => {
	try {
		const query = interaction.options.getString("query", true);
		if (!query) return;

		const results = await getPlayer("search").search(query);

		const tracks = results.tracks
			.filter((t) => t.title.length > 0 && t.title.length < 100 && t.url.length > 0 && t.url.length < 100)
			.slice(0, 10);

		if (!tracks.length) return;

		await interaction.respond(tracks.map((t) => ({ name: `${t?.metadata?.author} - ${t.title}`, value: t.url }))).catch(() => {});
		return;
	} catch (e) {
		return;
	}
};
