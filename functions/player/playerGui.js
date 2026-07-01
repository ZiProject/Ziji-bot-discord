const { useHooks } = require("zihooks");
const config = require("zihooks").useHooks.get("config");
const { Player, Track } = require("ziplayer");

const {
	MessageFlags,
	ButtonStyle,
	ButtonBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SectionBuilder,
	ThumbnailBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
} = require("discord.js");

const ZiIcons = require("../../utility/icon");

const CreateButton = ({ id = null, style = ButtonStyle.Secondary, label = null, emoji = null, disable = true }) => {
	const button = new ButtonBuilder().setCustomId(`B_player_${id}`).setStyle(style).setDisabled(disable);

	if (label) button.setLabel(label);
	if (emoji) button.setEmoji(emoji);

	return button;
};

const getQueryTypeIcon = (type) => {
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
};

module.exports = {
	data: {
		name: "playerGui",
		type: "player",
	},

	/**
	 * @param {object} playerfucs
	 * @param {Player} playerfucs.player
	 * @param {Track} playerfucs.tracks
	 */

	execute: async ({ player, tracks }) => {
		const track = tracks ?? player?.currentTrack ?? player?.previousTrack;

		let requestedBy =
			(track?.requestedBy === "auto" ? player.userdata.requestedBy : track?.requestedBy) ?? player.userdata.requestedBy;

		const lang = await useHooks.get("functions").get("ZiRank").execute({
			user: requestedBy,
			XpADD: 0,
		});

		const queryTypeIcon = getQueryTypeIcon(track?.source);

		const code = {
			flags: MessageFlags.IsComponentsV2,
			components: [],
			files: [],
			content: "",
		};

		const randomRGB = () => [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
		const container = new ContainerBuilder().setAccentColor(randomRGB());

		// =========================
		// HEADER
		// =========================

		container.addSectionComponents((section) =>
			section
				.addTextDisplayComponents((text) =>
					text.setContent(
						`[**${track?.metadata?.author ? `${track.metadata.author} - ` : ""}${track?.title ?? "No Track"}**](${track?.url})`,
					),
				)
				.setButtonAccessory((button) =>
					button
						.setStyle(ButtonStyle.Link)
						.setURL(track?.url || "https://google.com")
						.setLabel("Open"),
				)
				.addTextDisplayComponents((text) =>
					text.setContent(
						`Volume: **${player.volume}%** | Host: ${player.userdata.requestedBy} | Loop: **${repeatMode(player.loop(), player.autoPlay())}** | Lyrics: **${player.userdata?.lyrcsActive ? "ON" : "OFF"}**`,
					),
				)
				.addTextDisplayComponents((text) =>
					text.setContent(
						`now Playing at: **${player.userdata?.voiceChannel}** | Text Channel: **${player.userdata?.textChannel}** | Bot: **${player?.userdata?.client.user}**`,
					),
				),
		);

		if (config.webAppConfig?.musicControllerUrl) {
			container.addSectionComponents((section) =>
				section
					.addTextDisplayComponents((text) => text.setContent(`Web Player`))
					.setButtonAccessory((button) =>
						button
							.setStyle(ButtonStyle.Link)
							.setURL(config.webAppConfig.musicControllerUrl || "https://google.com")
							.setLabel("Launch Music Controller"),
					),
			);
		}

		container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));

		// =========================
		// PROGRESS
		// =========================

		container.addTextDisplayComponents((text) =>
			text.setContent(
				player.isPlaying || player.isPaused || !player.queue.isEmpty ?
					`### Progress\n${player.getProgressBar({
						barChar: "﹏",
						progressChar: "𓊝",
					})}`
				:	`### Queue Empty\n𓊝 ┃ ﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏ ┃ 𓊝`,
			),
		);

		// =========================
		// LOCK STATUS
		// =========================

		if (player.userdata.LockStatus) {
			container.addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(1));

			container.addTextDisplayComponents((text) =>
				text.setContent(`${ZiIcons.Lock} **${lang?.playerFunc?.Fields?.Lockdes || "Player Locked"}**`),
			);
		}

		// =========================
		// IMAGE
		// =========================

		if (track?.thumbnail) {
			container.addMediaGalleryComponents((gallery) => gallery.addItems(new MediaGalleryItemBuilder().setURL(track.thumbnail)));

			container.addSeparatorComponents((separator) => separator.setDivider(false).setSpacing(1));
		}

		// =========================
		// FOOTER
		// =========================

		container.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));

		container.addSectionComponents((section) =>
			section
				.addTextDisplayComponents((text) => text.setContent(`-# Requested by ${requestedBy?.username ?? "Unknown User"}`))
				.setButtonAccessory((button) =>
					button
						.setStyle(ButtonStyle.Link)
						.setURL(track?.url || "https://google.com")
						.setLabel("Open"),
				),
		);

		// =========================
		// RELATED TRACKS
		// =========================

		const filteredTracks = player.relatedTracks.filter((t) => t.url.length < 100).slice(0, 20);

		const trackOptions = filteredTracks.map((track, i) =>
			new StringSelectMenuOptionBuilder()
				.setLabel(`${i + 1}: ${track.title}`.slice(0, 99))
				.setDescription(`Duration: ${track.duration} | ${track.source}`)
				.setValue(track.url)
				.setEmoji(`${ZiIcons.Playbutton}`),
		);

		const disableOptions = [
			new StringSelectMenuOptionBuilder()
				.setLabel("No Track")
				.setDescription("XX:XX")
				.setValue("Ziji Bot")
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

		// =========================
		// FUNCTION MENU
		// =========================

		if (player.isPlaying || player.isPaused || !player.queue.isEmpty) {
			const functions = [
				{
					Label: "Search Tracks",
					Description: "Tìm kiếm bài hát",
					Value: "Search",
					Emoji: ZiIcons.search,
				},
				{
					Label: !player.userdata.LockStatus ? "Lock" : "Unlock",
					Description: !player.userdata.LockStatus ? "Khoá player" : "Mở khoá player",
					Value: "Lock",
					Emoji: !player.userdata.LockStatus ? ZiIcons.Lock : ZiIcons.UnLock,
				},
				{
					Label: "Loop",
					Description: "Lặp lại",
					Value: "Loop",
					Emoji: ZiIcons.loop,
				},
				{
					Label: "AutoPlay",
					Description: "Tự động phát",
					Value: "AutoPlay",
					Emoji: ZiIcons.loopA,
				},
				{
					Label: "Queue",
					Description: "Hàng đợi",
					Value: "Queue",
					Emoji: ZiIcons.queue,
				},
				{
					Label: "Shuffle",
					Description: "Trộn bài",
					Value: "Shuffle",
					Emoji: ZiIcons.shuffle,
				},
				{
					Label: "Filter",
					Description: "Bộ lọc",
					Value: "Filter",
					Emoji: ZiIcons.fillter,
				},
			];

			const functionOptions = functions.map((f) =>
				new StringSelectMenuOptionBuilder().setLabel(f.Label).setDescription(f.Description).setValue(f.Value).setEmoji(f.Emoji),
			);

			const functionRow = new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId("S_playerGui")
					.setPlaceholder(lang?.playerFunc?.RowFunc ?? "▶ | Player Functions")
					.addOptions(functionOptions)
					.setMaxValues(1)
					.setMinValues(1),
			);

			const buttonRow = new ActionRowBuilder().addComponents(
				CreateButton({
					id: "refresh",
					emoji: `${ZiIcons.refesh}`,
					disable: false,
				}),
				CreateButton({
					id: "previous",
					emoji: `${ZiIcons.prev}`,
					disable: !player?.previousTrack,
				}),
				CreateButton({
					id: "pause",
					emoji: player.isPlaying ? `${ZiIcons.pause}` : `${ZiIcons.play}`,
					disable: false,
				}),
				CreateButton({
					id: "next",
					emoji: `${ZiIcons.next}`,
					disable: false,
				}),
				CreateButton({
					id: "stop",
					emoji: `${ZiIcons.stop}`,
					disable: false,
				}),
			);
			container.addActionRowComponents(relatedTracksRow);
			container.addActionRowComponents(functionRow);
			container.addActionRowComponents(buttonRow);
			code.components.push(container);
			// const util = require("node:util");
			// console.log(
			// 	util.inspect(code.components, {
			// 		depth: null,
			// 		colors: true,
			// 		showHidden: false,
			// 	}),
			// );
		} else {
			const buttonRow = new ActionRowBuilder().addComponents(
				CreateButton({
					id: "refresh",
					emoji: `${ZiIcons.refesh}`,
					disable: false,
				}),
				CreateButton({
					id: "previous",
					emoji: `${ZiIcons.prev}`,
					disable: !player?.previousTrack,
				}),
				CreateButton({
					id: "search",
					emoji: `${ZiIcons.search}`,
					disable: false,
				}),
				CreateButton({
					id: "autoPlay",
					emoji: `${ZiIcons.loopA}`,
					disable: false,
				}),
				CreateButton({
					id: "stop",
					emoji: `${ZiIcons.stop}`,
					disable: false,
				}),
			);
			container.addActionRowComponents(relatedTracksRow);
			container.addActionRowComponents(buttonRow);

			code.components.push(container);
		}

		return code;
	},
};
