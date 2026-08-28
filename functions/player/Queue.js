const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	AttachmentBuilder,
	ButtonStyle,
} = require("discord.js");
const ZiIcons = require("./../../utility/icon");
const { useHooks } = require("zihooks");
const { fork } = require("child_process");
const path = require("path");

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
 * @param { ButtonInteraction } interaction
 * @param { import("ziplayer").Player } player
 */

module.exports.execute = async ({ interaction, player, Nextpage = true }) => {
	if (!player.queue?.tracks?.length) return interaction.reply({ content: "There is no music playing in this server" });
	await interaction.deferReply();
	const fieldName = interaction?.message?.embeds?.at(0)?.data?.fields?.at(0);
	const mainRequire = fieldName?.value?.includes("﹏");
	const pageData = fieldName?.name?.replace("Page:", " ").trim().split("/");
	const queuetrack = [];
	let code = { content: "" };
	player.queue.tracks.map(async (track, i) => {
		queuetrack.push(track);
	});
	if (!queuetrack.length) {
		if (!mainRequire) {
			await interaction?.deleteReply().catch((e) => console.log);
			return interaction.message.delete().catch((e) => console.log);
		}
		return interaction.editReply({ content: "There is no music playing in this server" });
	}
	let page = eval(pageData?.at(0) || 1);
	const toltalPage = Math.ceil(queuetrack.length / 20);
	if (!mainRequire) {
		if (Nextpage) {
			page = (page % toltalPage) + 1;
		} else {
			page = page - 1 < 1 ? toltalPage : page - 1;
		}
	}
	const currentIndex = (page - 1) * 20;
	let now = page * 20 - 20;
	const currentTrack = queuetrack.slice(currentIndex, currentIndex + 20);
	if (!currentTrack && !currentTrack.length) return;
	/*=================== embed / image =====================*/

	if (useHooks.get("config")?.ImageSearch) {
		const searchPlayer = currentTrack.map((track, i) => ({
			index: ++now,
			avatar: track?.thumbnail ?? "https://i.imgur.com/vhcoFZo_d.webp",
			displayName: track.title.slice(0, currentTrack.length > 1 ? 30 : 80),
			time: track.duration,
		}));

		try {
			const attachment = await buildImageInWorker(searchPlayer, `Queue of ${interaction.guild.name}`);
			const embed = new EmbedBuilder()
				.setTitle(`${ZiIcons.queue} Queue of ${interaction.guild.name}`)
				.setColor("Random")
				.addFields({ name: `Page: ${page} / ${toltalPage}`, value: " " })
				.setImage("attachment://queue.png");
			code.embeds = [embed];
			code.files = [attachment];
		} catch (error) {
			console.error("Error building image:", error);
			const embed = new EmbedBuilder()
				.setTitle(`${ZiIcons.queue} Queue of ${interaction.guild.name}`)
				.setColor("Random")
				.addFields({ name: `Page: ${page} / ${toltalPage}`, value: " " })
				.setDescription(
					`${currentTrack.map((track) => `${++now} | **${`${track?.title}`.slice(0, 25)}** - [${track.duration}](${track.url})`).join("\n")}`,
				);
			code.embeds = [embed];
		}
	} else {
		const embed = new EmbedBuilder()
			.setTitle(`${ZiIcons.queue} Queue of ${interaction.guild.name}`)
			.setColor("Random")
			.addFields({ name: `Page: ${page} / ${toltalPage}`, value: " " })
			.setDescription(
				`${currentTrack.map((track) => `${++now} | **${`${track?.title}`.slice(0, 25)}** - [${track.duration}](${track.url})`).join("\n")}`,
			);
		code.embeds = [embed];
	}
	/*=================== components =====================*/
	const queueFund = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_queue_clear").setLabel("Clear All").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_queue_del").setEmoji("🗑️").setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_queue_Shuffle").setEmoji(ZiIcons.shuffle).setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId("B_cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary),
	);
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_queue_Page").setLabel(`Page: ${page}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
		new ButtonBuilder().setCustomId("B_queue_prev").setStyle(ButtonStyle.Secondary).setLabel("◀"),
		new ButtonBuilder().setCustomId("B_queue_refresh").setStyle(ButtonStyle.Secondary).setEmoji(ZiIcons.refesh),
		new ButtonBuilder().setCustomId("B_queue_next").setStyle(ButtonStyle.Secondary).setLabel("▶"),
	);
	code.components = [queueFund, row];
	/*=================== send file =====================*/
	if (mainRequire) return interaction.editReply(code);
	interaction.deleteReply().catch((e) => {});
	interaction.message.edit(code);
	return;
};
//====================================================================//
module.exports.data = {
	name: "Queue",
	type: "player",
};
//Page: 3 / 10
