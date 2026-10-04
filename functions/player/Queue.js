const {
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const ZiIcons = require("./../../utility/icon");
const { useHooks } = require("zihooks");
const { createImageStudioAttachment } = require("../../utility/imageStudio");

function msToTime(milliseconds) {
	if (typeof milliseconds !== "number") return String(milliseconds ?? "");
	const pad = (value) => ("00" + value).slice(-2);
	return `${pad((milliseconds / 3.6e6) | 0)}:${pad(((milliseconds % 3.6e6) / 6e4) | 0)}:${pad(((milliseconds % 6e4) / 1000) | 0)}`;
}

function visitComponents(components, callback) {
	for (const component of components ?? []) {
		callback(component);
		visitComponents(component.components, callback);
	}
}

function getQueuePage(components) {
	let pageLabel;
	visitComponents(components, (component) => {
		if (component.customId === "B_queue_Page") pageLabel = component.label;
	});
	return Number(/^Page:\s*(\d+)/.exec(pageLabel ?? "")?.[1]) || 1;
}

function hasQueueControls(components) {
	let found = false;
	visitComponents(components, (component) => {
		if (component.customId === "B_queue_Page") found = true;
	});
	return found;
}

function createV2Message(content) {
	const container = new ContainerBuilder().addTextDisplayComponents((text) => text.setContent(content));
	return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

/**
 * @param { object } param0
 * @param { import("discord.js").MessageComponentInteraction } param0.interaction
 * @param { import("ziplayer").Player } param0.player
 * @param { boolean } param0.Nextpage
 * @returns
 */

module.exports.execute = async ({ interaction, player, Nextpage = true }) => {
	if (!player.queue?.tracks?.length) return interaction.reply(createV2Message("There is no queue in this player"));
	await interaction.deferReply();

	const queueMessage = hasQueueControls(interaction.message?.components);
	const queueTracks = [...player.queue.tracks];
	if (!queueTracks.length) {
		const emptyMessage = createV2Message("There is no music playing in this server");
		if (queueMessage) {
			await interaction.deleteReply().catch(() => {});
			return interaction.message.edit(emptyMessage);
		}
		return interaction.editReply(emptyMessage);
	}

	const totalPage = Math.ceil(queueTracks.length / 20);
	let page = getQueuePage(interaction.message?.components);
	if (queueMessage) {
		page =
			Nextpage ? (page % totalPage) + 1
			: page - 1 < 1 ? totalPage
			: page - 1;
	}

	const firstTrackIndex = (page - 1) * 20;
	const currentTrack = queueTracks.slice(firstTrackIndex, firstTrackIndex + 20);
	const searchPlayer = currentTrack.map((track, index) => ({
		index: firstTrackIndex + index + 1,
		avatar: track?.thumbnail ?? "https://i.imgur.com/vhcoFZo_d.webp",
		displayName: track.title.slice(0, currentTrack.length > 1 ? 30 : 80),
		author: String(track?.metadata?.author ?? track?.author ?? ""),
		views: String(track?.metadata?.views ?? track?.views ?? ""),
		time: msToTime(track.duration),
		source: String(track?.source ?? ""),
	}));

	let attachment;
	if (useHooks.get("config")?.ImageSearch) {
		try {
			attachment = await createImageStudioAttachment(
				{ type: "song", title: `Queue of ${interaction.guild.name}`, layout: "grid", items: searchPlayer },
				"queue.png",
			);
		} catch (error) {
			console.error("Error building queue image:", error);
		}
	}

	const trackList = currentTrack
		.map(
			(track, index) =>
				`${firstTrackIndex + index + 1} | **${`${track?.title}`.slice(0, 50)}** - [${msToTime(track.duration)}](${track.url})`,
		)
		.join("\n");
	const container = new ContainerBuilder()
		.addTextDisplayComponents((text) =>
			text.setContent(`## ${ZiIcons.queue} Queue of ${interaction.guild.name}\n-# Page: ${page} / ${totalPage}`),
		)
		.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(1));

	if (attachment) {
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL("attachment://queue.png")),
		);
	} else {
		container.addTextDisplayComponents((text) => text.setContent(trackList));
	}

	const queueFund = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_queue_clear").setLabel("Clear All").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_queue_del").setEmoji("🗑️").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_queue_Shuffle").setEmoji(ZiIcons.shuffle).setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary),
	);
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId("B_queue_Page")
			.setLabel(`Page: ${page} / ${totalPage}`)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		new ButtonBuilder().setCustomId("B_queue_prev").setStyle(ButtonStyle.Secondary).setLabel("◀"),
		new ButtonBuilder().setCustomId("B_queue_refresh").setStyle(ButtonStyle.Secondary).setEmoji(ZiIcons.refesh),
		new ButtonBuilder().setCustomId("B_queue_next").setStyle(ButtonStyle.Secondary).setLabel("▶"),
	);
	container.addActionRowComponents(queueFund, row);

	const response = {
		flags: MessageFlags.IsComponentsV2,
		components: [container],
		files: attachment ? [attachment] : [],
	};
	if (queueMessage) {
		await interaction.deleteReply().catch(() => {});
		return interaction.message.edit(response);
	}
	return interaction.editReply(response);
};
//====================================================================//
module.exports.data = {
	name: "Queue",
	type: "player",
};
//Page: 3 / 10
