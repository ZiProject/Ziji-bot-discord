const { useHooks } = require("zihooks");
const config = require("zihooks").useHooks.get("config");
const { getPlayer, Player, Track } = require("ziplayer");
const {
	Client,
	ButtonStyle,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} = require("discord.js");
const ZiIcons = require("../../utility/icon");

const CreateButton = ({ id = null, style = ButtonStyle.Secondary, label = null, emoji = null, disable = true }) => {
	const button = new ButtonBuilder().setCustomId(`B_player_${id}`).setStyle(style).setDisabled(disable);
	if (label) button.setLabel(label);
	if (emoji) button.setEmoji(emoji);
	return button;
};

// Helper function to get query Type Icon
const getQueryTypeIcon = (type, raw) => {
	switch (type) {
		case "youtube":
		case "ytsr":
			return ZiIcons.youtubeIconURL;
		case "spotify":
			return ZiIcons.spotifyIconURL;
		case "soundcloud":
			return ZiIcons.soundcloudIconURL;
		default:
			return ZiIcons.AttachmentIconURL;
	}
};

const repeatMode = (loop, auto) => {
	if (loop == "track") return `${ZiIcons.loop1} Track`;
	if (loop == "queue") return `${ZiIcons.loopQ} Queue`;
	if (auto) return `${ZiIcons.loopA} AutoPlay`;
	return "OFF";
}; //["OFF", `${ZiIcons.loop1} Track`, `${ZiIcons.loopQ} Queue`, `${ZiIcons.loopA} AutoPlay`];

module.exports = {
	data: { name: "player_func", type: "player" },

	/**
	 * @param { object } playerfucs
	 * @param { Player } playerfucs.player
	 * @param { Track } playerfucs.tracks
	 * @returns
	 */

	execute: async ({ player, tracks }) => {
		const track = tracks ?? player?.currentTrack ?? player?.previousTrack;
		let requestedBy =
			(track?.requestedBy === "auto" ? player.userdata.requestedBy : track?.requestedBy) ?? player.userdata.requestedBy;

		const lang = await useHooks.get("functions").get("ZiRank").execute({ user: requestedBy, XpADD: 0 });

		const queryTypeIcon = getQueryTypeIcon(track?.source);

		const embed = new EmbedBuilder()
			.setAuthor({
				name: `${track?.metadata?.author} - ${track?.title}`.slice(0, 256),
				iconURL: `${queryTypeIcon}`,
				url: track?.url,
			})
			.setDescription(
				`Volume: **${player.volume}** % - Host: ${player.userdata.requestedBy} <a:_:${
					ZiIcons.animatedIcons[Math.floor(Math.random() * ZiIcons.animatedIcons.length)]
				}>${config.webAppConfig?.musicControllerUrl ? `\n[Click to launch music controller](${config.webAppConfig.musicControllerUrl})` : ""}`,
			)
			.setColor(lang?.color || "Random")
			.setFooter({
				text: `${lang.until.requestBy} ${requestedBy?.username}`,
				iconURL:
					requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? useHooks.get("client").user.displayAvatarURL?.({ size: 1024 }),
			})
			.setTimestamp();
		if (queryTypeIcon === ZiIcons.youtubeIconURL) {
			embed.setImage(track?.thumbnail);
		} else {
			embed.setThumbnail(track?.thumbnail);
		}

		const code = { content: "" };

		const filteredTracks = player.relatedTracks.filter((t) => t.url.length < 100).slice(0, 20);

		const trackOptions = filteredTracks.map((track, i) => {
			return new StringSelectMenuOptionBuilder()
				.setLabel(`${i + 1}: ${track.title}`.slice(0, 99))
				.setDescription(`Duration: ${track.duration} source: ${track.queryType}`)
				.setValue(`${track.url}`)
				.setEmoji(`${ZiIcons.Playbutton}`);
		});

		const disableOptions = [
			new StringSelectMenuOptionBuilder()
				.setLabel("No Track")
				.setDescription(`XX:XX`)
				.setValue(`Ziji Bot`)
				.setEmoji(`${ZiIcons.Playbutton}`),
		];

		const relatedTracksRow = new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId("S_player_Track")
				.setPlaceholder(lang?.playerFunc?.RowRel ?? "▶ | Select a song to add to the queue")
				.addOptions(trackOptions.length ? trackOptions : disableOptions)
				.setMaxValues(1)
				.setMinValues(1)
				.setDisabled(!trackOptions.length),
		);

		if (player.isPlaying || player.isPaused || !player.queue.isEmpty) {
			embed.addFields({
				name: " ",
				value: `${player.getProgressBar({ barChar: "﹏", progressChar: "𓊝" })}`,
			});
			const functions = [
				{
					Label: "Search Tracks",
					Description: lang?.playerFunc?.Fields?.Search || "Tìm kiếm bài hát",
					Value: "Search",
					Emoji: ZiIcons.search,
				},
				{
					Label:
						!player.userdata.LockStatus ? lang?.playerFunc?.Fields?.Lock || "Lock" : lang?.playerFunc?.Fields?.UnLock || "UnLock",
					Description:
						!player.userdata.LockStatus ?
							lang?.playerFunc?.Fields?.Lockdes || "Khoá truy cập player"
						:	lang?.playerFunc?.Fields?.Unlockdes || "Mở khoá truy cập player",
					Value: "Lock",
					Emoji: !player.userdata.LockStatus ? ZiIcons.Lock : ZiIcons.UnLock,
				},
				{
					Label: "Loop",
					Description: lang?.playerFunc?.Fields?.Loop || "Lặp Lại",
					Value: "Loop",
					Emoji: ZiIcons.loop,
				},
				{
					Label: "AutoPlay",
					Description: lang?.playerFunc?.Fields?.AutoPlay || "Tự động phát",
					Value: "AutoPlay",
					Emoji: ZiIcons.loopA,
				},
				{
					Label: "Queue",
					Description: lang?.playerFunc?.Fields?.Queue || "Hàng đợi",
					Value: "Queue",
					Emoji: ZiIcons.queue,
				},
				{
					Label: "Mute",
					Description: lang?.playerFunc?.Fields?.Mute || "Chỉnh âm lượng về 0",
					Value: "Mute",
					Emoji: ZiIcons.mute,
				},
				{
					Label: "Unmute",
					Description: lang?.playerFunc?.Fields?.Unmute || "Mở khoá âm lượng",
					Value: "Unmute",
					Emoji: ZiIcons.volinc,
				},
				{
					Label: "Vol +",
					Description: lang?.playerFunc?.Fields?.VolInc || "Tăng âm lượng",
					Value: "volinc",
					Emoji: ZiIcons.volinc,
				},
				{
					Label: "Vol -",
					Description: lang?.playerFunc?.Fields?.VolDec || "Giảm âm lượng",
					Value: "voldec",
					Emoji: ZiIcons.voldec,
				},
				{
					Label: "Lyrics",
					Description: lang?.playerFunc?.Fields?.Lyrics,
					Value: "Lyrics",
					Emoji: ZiIcons.lyrics,
				},
				{
					Label: "Shuffle",
					Description: lang?.playerFunc?.Fields?.Shuffle || "Trộn bài",
					Value: "Shuffle",
					Emoji: ZiIcons.shuffle,
				},
				{
					Label: "Filter",
					Description: lang?.playerFunc?.Fields?.Filter || "Quản lý bộ lọc",
					Value: "Filter",
					Emoji: ZiIcons.fillter,
				},
			];

			const filteredFunctions = functions.filter((f) => {
				if (player.queue.isEmpty && (f.Label === "Shuffle" || f.Label === "Queue")) return false;
				if (player.volume > 99 && f.Value === "volinc") return false;
				if (player.volume < 1 && f.Value === "voldec") return false;
				if (player.volume === 0 && f.Value === "Mute") return false;
				if (player.volume !== 0 && f.Value === "Unmute") return false;
				return true;
			});

			const functionOptions = filteredFunctions.map((f) => {
				return new StringSelectMenuOptionBuilder()
					.setLabel(f.Label)
					.setDescription(f.Description)
					.setValue(f.Value)
					.setEmoji(f.Emoji);
			});

			const functionRow = new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId("S_player_Func")
					.setPlaceholder(lang?.playerFunc?.RowFunc ?? "▶ | Chọn một chức năng khác để điều khiển player")
					.addOptions(functionOptions)
					.setMaxValues(1)
					.setMinValues(1),
			);

			const buttonRow = new ActionRowBuilder().addComponents(
				CreateButton({ id: "refresh", emoji: `${ZiIcons.refesh}`, disable: false }),
				CreateButton({
					id: "previous",
					emoji: `${ZiIcons.prev}`,
					disable: !player?.previousTrack,
				}),
				CreateButton({
					id: "pause",
					emoji: `${player.isPlaying ? `${ZiIcons.pause}` : `${ZiIcons.play}`}`,
					disable: false,
				}),
				CreateButton({ id: "next", emoji: `${ZiIcons.next}`, disable: false }),
				CreateButton({ id: "stop", emoji: `${ZiIcons.stop}`, disable: false }),
			);

			code.components = [relatedTracksRow, functionRow, buttonRow];
		} else {
			embed
				.setDescription(lang?.playerFunc?.QueueEmpty || `❌ | Hàng đợi trống\n✅ | Bạn có thể thêm 1 số bài hát`)
				.setColor("Red")
				.addFields({ name: " ", value: `𓊝 ┃ ﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏ ┃ 𓊝` });

			const buttonRow = new ActionRowBuilder().addComponents(
				CreateButton({ id: "refresh", emoji: `${ZiIcons.refesh}`, disable: false }),
				CreateButton({
					id: "previous",
					emoji: `${ZiIcons.prev}`,
					disable: !player?.previousTrack,
				}),
				CreateButton({ id: "search", emoji: `${ZiIcons.search}`, disable: false }),
				CreateButton({ id: "autoPlay", emoji: `${ZiIcons.loopA}`, disable: false }),
				CreateButton({ id: "stop", emoji: `${ZiIcons.stop}`, disable: false }),
			);
			code.components = [relatedTracksRow, buttonRow];
		}
		if (!!player.userdata.LockStatus) {
			embed.addFields({
				name: `${ZiIcons.Lock} **${lang?.playerFunc?.Fields?.Lockdes}**`,
				value: " ",
				inline: false,
			});
		}

		embed.addFields({
			name: `${lang?.playerFunc?.Fields?.Loop || "Lặp lại"}: ${repeatMode(player.loop(), player.autoPlay())}`,
			value: " ",
			inline: true,
		});
		embed.addFields({
			name: `Lyrics: ${player.userdata?.lyrcsActive ? "ON" : "OFF"}`,
			value: " ",
			inline: true,
		});
		// if (!!queue?.filters?.ffmpeg?.toArray().length) {
		// 	embed.addFields({
		// 		name: ` `,
		// 		value: `**${lang?.playerFunc?.Fields?.Filter || "Filter"}: ${queue?.filters?.ffmpeg?.getFiltersEnabled()}**`.slice(
		// 			0,
		// 			1020,
		// 		),
		// 		inline: false,
		// 	});
		// }
		code.embeds = [embed];
		code.files = [];

		return code;
	},
};
