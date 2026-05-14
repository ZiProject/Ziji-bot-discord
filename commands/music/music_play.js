const { useHooks } = require("zihooks");
const { getPlayer, getManager } = require("ziplayer");
const config = useHooks.get("config");

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
		{
			name: "broadcast",
			description: "Phát nhạc từ guild khác",
			type: 1, // sub command
			options: [
				{
					name: "guild",
					description: "guildID",
					required: true,
					autocomplete: true,
					type: 3,
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
	const command = useHooks.get("functions").get("playerController");
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
	} else if (commandtype === "broadcast") {
		const leaderGuild = interaction.options?.getString("guild");
		await interaction.deferReply().catch((e) => {});
		const player = await useHooks.get("functions").get("playerCreate")?.execute({ interaction, lang, options: {} });
		if (!!player?.connection) {
			await getManager().subscribePlaybackMirror({
				leaderGuildId: leaderGuild,
				followerGuildIds: [`${interaction.guild.id}`],
				mirrorUserId: interaction.user.id,
				forwardMode: true,
			});
		}
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
		const guild = interaction.options.getString("guild", true);
		if (guild) {
			const players = await getManager().getall();
			console.log(players);
			return await interaction
				.respond(
					players.map((plr) => ({
						name: `${plr.guildId} - ${plr?.queue?.currentTrack ?? "No Tracks"}`.slice(0, 100),
						value: plr.guildId,
					})),
				)
				.catch((e) => {
					console.log(e);
				});
		}
		if (!query) return;

		const results = await getManager().search(query);

		const tracks = results.tracks
			.filter((t) => t.title.length > 0 && t.title.length < 100 && t.url.length > 0 && t.url.length < 100)
			.slice(0, 10);

		if (!tracks.length) return;

		await interaction
			.respond(tracks.map((t) => ({ name: `${t?.metadata?.author?.slice(0, 20)} - ${t.title}`.slice(0, 100), value: t.url })))
			.catch(() => {});
		return;
	} catch (e) {
		return;
	}
};
