const {
	MessageFlags,
	ContainerBuilder,
	TextDisplayBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	AttachmentBuilder,
	ButtonStyle,
} = require("discord.js");
const ZiIcons = require("./../../utility/icon");
const { useHooks } = require("zihooks");
const { fork } = require("child_process");
const path = require("path");
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

async function buildImageInWorker(searchPlayer, query) {
	return new Promise((resolve, reject) => {
		const workerPath = path.resolve(__dirname, "../../utility/musicImage.js");
		let settled = false;
		let timeout;
		const child = fork(workerPath, [], {
			stdio: ["ignore", "ignore", "ignore", "ipc"],
		});

		const cleanup = () => {
			clearTimeout(timeout);
			child.removeAllListeners("message");
			child.removeAllListeners("error");
			child.removeAllListeners("exit");
			if (child.connected) child.disconnect();
			if (!child.killed) child.kill();
		};

		const settle = (callback) => {
			if (settled) return;
			settled = true;
			cleanup();
			callback();
		};

		timeout = setTimeout(() => {
			settle(() => reject(new Error("Image worker timed out after 30 seconds")));
		}, 30_000);

		child.once("message", (message) => {
			if (!message || typeof message !== "object") {
				return settle(() => reject(new Error("Invalid response from image worker")));
			}

			if (message.type === "error") {
				return settle(() => reject(new Error(message.error || "Image worker failed")));
			}

			if (message.type !== "result" || typeof message.data !== "string") {
				return settle(() => reject(new Error("Invalid image data from image worker")));
			}

			try {
				const buffer = Buffer.from(message.data, "base64");
				const attachment = new AttachmentBuilder(buffer, { name: "queue.png" });
				settle(() => resolve(attachment));
			} catch (error) {
				settle(() => reject(error));
			}
		});

		child.once("error", (error) => {
			settle(() => reject(error));
		});

		child.once("exit", (code, signal) => {
			if (!settled) {
				settle(() => reject(new Error(`Image worker stopped with code ${code}${signal ? ` (${signal})` : ""}`)));
			}
		});

		child.send({ searchPlayer, query }, (error) => {
			if (error) settle(() => reject(error));
		});
	});
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
			try {
				attachment = await createImageStudioAttachment(
					{ type: "song", title: `Queue of ${interaction.guild.name}`, layout: "grid", items: searchPlayer },
					"queue.png",
				);
			} catch (error) {
				console.warn("Image Studio generation failed; falling back to image worker", error);
				attachment = await buildImageInWorker(searchPlayer, `Queue of ${interaction.guild.name}`);
			}
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
