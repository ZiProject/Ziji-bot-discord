const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, BaseInteraction, AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } = require("discord.js");
const { fork } = require("child_process");
const path = require("path");
const ZiIcons = require("../../utility/icon");
const { getManager, getPlayer } = require("ziplayer");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
//====================================================================//

module.exports.data = {
	name: "PlayerSearch",
	type: "player",
};

function msToTime(s) {
	if (typeof s !== "number") return s;
	var pad = (n, z = 2) => ("00" + n).slice(-z);
	return pad((s / 3.6e6) | 0) + ":" + pad(((s % 3.6e6) / 6e4) | 0) + ":" + pad(((s % 6e4) / 1000) | 0);
}
//====================================================================//

async function buildImageInWorker(searchPlayer, query) {
	logger.debug("Starting buildImageInWorker");
	return new Promise((resolve, reject) => {
		const workerPath = path.resolve(__dirname, "../../utility/musicImage.js");
		logger.debug(`Creating isolated image process: ${workerPath}`);

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
				const attachment = new AttachmentBuilder(buffer, { name: "search.png" });
				settle(() => resolve(attachment));
			} catch (error) {
				settle(() => reject(error));
			}
		});

		child.once("error", (error) => {
			logger.error("Image worker process encountered an error", error);
			settle(() => reject(error));
		});

		child.once("exit", (code, signal) => {
			logger.debug(`Image worker process exited with code ${code}${signal ? ` (${signal})` : ""}`);
			if (!settled) {
				settle(() => reject(new Error(`Image worker stopped with code ${code}${signal ? ` (${signal})` : ""}`)));
			}
		});

		child.send({ searchPlayer, query }, (error) => {
			if (error) {
				logger.error("Failed to send data to image worker", error);
				settle(() => reject(error));
			}
		});
	});
}

//====================================================================//

/**
 * @param { Object } playerSearch
 * @param { import ("discord.js").BaseInteraction } playerSearch.interaction
 * @param { String } playerSearch.query search Query
 * @param { import ("../../lang/vi") } playerSearch.lang
 */
module.exports.execute = async ({ interaction, query, lang }) => {
	const voiceChannel = interaction.member?.voice?.channel;
	const player = getPlayer(`${interaction.guild.id}::${voiceChannel?.id}`);
	const searchWithFallback = async () => {
		if (player) {
			try {
				const results = await player.search(query, interaction.user);

				if (results?.tracks?.length) {
					return results;
				}
			} catch (error) {
				logger.warn("[Search Fallback]", error);
			}
		}

		return getManager().search(query, interaction.user);
	};

	const results = await searchWithFallback();
	const tracks = filterTracks(results?.tracks);
	logger.debug(`Search results:  ${tracks?.length}`);

	if (!tracks?.length) {
		logger.debug("No tracks found");
		return interaction
			.editReply({
				embeds: [new EmbedBuilder().setTitle("Không tìm thấy kết quả nào cho:").setDescription(`${query}`).setColor("Red")],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId("B_cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary),
					),
				],
			})
			.catch(() => {});
	}

	logger.debug("Sending search results");
	return sendSearchResults(interaction, query, tracks, lang);
};

function filterTracks(tracks) {
	const uniqueTracks = [];
	const seenUrls = new Set();
	for (const track of tracks) {
		if (track?.url?.length < 100 && !seenUrls.has(track?.url)) {
			uniqueTracks.push(track);
			seenUrls.add(track?.url);
			if (uniqueTracks.length >= 20) break;
		}
	}
	return uniqueTracks;
}

async function sendSearchResults(interaction, query, tracks, lang) {
	logger.debug("Preparing to send search results");
	const creator_Track = tracks.map((track, i) => {
		return new StringSelectMenuOptionBuilder()
			.setLabel(`${i + 1}: ${track.title}`.slice(0, 99))
			.setDescription(`Duration: ${msToTime(track.duration)} source: ${track.source}`)
			.setValue(`${track.url}`)
			.setEmoji(`${ZiIcons.Playbutton}`);
	});

	const cancelOption = new StringSelectMenuOptionBuilder()
		.setLabel("Hủy")
		.setDescription("Hủy bỏ")
		.setValue("B_cancel")
		.setEmoji(ZiIcons.noo);

	const row = new ActionRowBuilder().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId("S_player_Search")
			.setPlaceholder("▶ | Chọn một bài hát để phát")
			.addOptions([cancelOption, ...creator_Track])
			.setMaxValues(1)
			.setMinValues(1),
	);

	if (config?.ImageSearch) {
		logger.debug("Image search is enabled");
		const searchPlayer = tracks.map((track, i) => ({
			index: i + 1,
			avatar: track?.thumbnail,
			displayName: track.title.slice(0, tracks.length > 1 ? 30 : 80),
			time: msToTime(track.duration),
			source: track.source,
		}));

		try {
			const attachment = await buildImageInWorker(searchPlayer, query);
			logger.debug("Image built successfully");
			return interaction.editReply({ embeds: [], components: [row], files: [attachment] }).catch(() => {});
		} catch (error) {
			console.error("Error building image:", error);
		}
	}
	const embed = new EmbedBuilder()
		.setTitle("Tìm kiếm kết quả:")
		.setDescription(`${query}`)
		.setColor(lang?.color || "Random")
		.addFields(
			tracks.map((track, i) => ({
				name: `${i + 1}: ${track?.metadata?.author} - ${track.title.slice(0, 50 - track?.metadata?.author.length)} \`[${msToTime(track.duration)}]\``.slice(
					0,
					99,
				),
				value: ` `,
				inline: false,
			})),
		);
	logger.debug("Search results sent");
	return interaction.editReply({ embeds: [embed], components: [row] }).catch(async () => {
		logger.debug("Failed to edit reply with search results");
		await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true }).catch(async () => {
			await interaction.channel.send({ embeds: [embed], components: [row] }).catch(() => {
				logger.error("Failed to send search results in channel");
			});
		});
	});
}
//#endregion Search Track
