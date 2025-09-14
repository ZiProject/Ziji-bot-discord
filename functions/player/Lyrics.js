const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuInteraction, ButtonStyle } = require("discord.js");
const { useMainPlayer, useQueue, Util, GuildQueue } = require("discord-player");

const player = useMainPlayer();
const ZiIcons = require("../../utility/icon");
/**
 * Executes the command to edit metadata.
 * @param { StringSelectMenuInteraction } interaction - The guild where the command is executed.
 * @param { Object } options - The metadata to update.
 * @param { String } options.query - The Query search lyrics
 * @param { String } options.type - The type of lyrics syncedLyrics or plainLyrics
 * @param { GuildQueue } options.queue - The Queue
 */

module.exports.execute = async (interaction, options) => {
	const queue = options?.queue || interaction?.guild?.id ? useQueue(interaction?.guild?.id) : null;
	const lang = options?.lang || queue?.metadata?.lang;
	const query = options?.query || interaction?.values?.[0] || interaction?.options?.getString("query") || null;

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId("B_Lyrics_input")
			.setStyle(ButtonStyle.Secondary)
			.setLabel(lang?.Lyrics?.input_name || "Input Lyrics Name")
			.setEmoji(ZiIcons?.search),
		new ButtonBuilder()
			.setCustomId("B_Lyrics_cancel")
			.setStyle(ButtonStyle.Secondary)
			.setLabel(lang?.Lyrics?.disable_slrc || "Disable syncedLyrics")
			.setEmoji("❌"),
		new ButtonBuilder().setURL("https://lrclib.net/").setStyle(ButtonStyle.Link).setLabel("lrclib"),
	);
	//embed
	const LyricsEmbed = new EmbedBuilder()
		.setDescription(`${lang?.Lyrics?.no_res || "❌ | No Lyrics Found!"}\n- Query:**${query}**`)
		.setColor(lang?.color || "Random")
		.setThumbnail(queue?.currentTrack?.thumbnail || null);

	const lyrics = await this.search({ query, queue });

	try {
		const trimmedLyrics = lyrics?.at(0)?.plainLyrics.substring(0, 1997);

		if (trimmedLyrics?.length) {
			LyricsEmbed.setTitle(`${lyrics[0]?.trackName} - ${lyrics[0]?.artistName}`).setDescription(
				trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics,
			);
		}
	} catch (error) {
		console.warn("Error plainLyrics from lyrics:", error);
	}

	// plainLyrics
	if (options?.type !== "syncedLyrics") {
		return interaction.editReply({ content: "", embeds: [LyricsEmbed] }).catch(async () => {
			await interaction.followUp({ content: "", embeds: [LyricsEmbed] }).catch(() => {});
		});
	}
	// syncedLyrics
	if (!queue) return;

	await queue.metadata.ZiLyrics?.mess.edit({ content: "", components: [row], embeds: [LyricsEmbed] }).catch(() => {});

	let Synced_res = lyrics?.filter((l) => !!l.syncedLyrics);
	if (!Synced_res.length) return;

	const syncedLyrics = queue.syncedLyrics(Synced_res.at(0));

	let current_Lyric = "",
		previous_Lyric = "",
		pre_previous_Lyric = "";

	syncedLyrics.onChange(async (lyricss, timestamp) => {
		current_Lyric = `[${Util.buildTimeCode(Util.parseMS(timestamp))}]: ${lyricss}`;

		const embed = LyricsEmbed.setTitle(`${lyrics[0]?.trackName} - ${lyrics[0]?.artistName}`).setDescription(
			`${pre_previous_Lyric}\n${previous_Lyric}\n**${current_Lyric}**.`,
		);

		//store previous Lyric
		pre_previous_Lyric = previous_Lyric;
		previous_Lyric = current_Lyric;

		//send messenger
		await queue.metadata.ZiLyrics?.mess.edit({ content: "", components: [row], embeds: [embed] }).catch(async () => {
			//update New
			queue.metadata.ZiLyrics.mess = await queue.metadata.ZiLyrics?.channel
				.send({ content: "", components: [row], embeds: [embed] })
				.catch(() => {});
		});
	});
	// subscribe syncedLyrics
	queue.metadata.ZiLyrics.unsubscribe = syncedLyrics.subscribe();
	return;
};

/**
 * Command data for Lyrics.
 */

module.exports.data = {
	name: "Lyrics",
	type: "player",
	enable: false,
};

module.exports.search = async ({ query, queue }) => {
	const genQuery = (q) => q?.replace(/lyrics|mv|full|official|music|video/gi, "").replace(/ft/gi, "feat");

	const queries = [query, queue?.currentTrack?.cleanTitle, queue?.currentTrack?.title].filter(Boolean).map(genQuery);

	for (const q of queries) {
		const lyrics = await player.lyrics.search({ q });
		if (lyrics) return lyrics;
	}

	return null;
};
