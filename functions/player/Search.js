const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, BaseInteraction, AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } = require("discord.js");
const { Worker } = require("worker_threads");
const langdef = require("./../../lang/vi");
const ZiIcons = require("./../../utility/icon");
const { getPlayer, Player, getManager } = require("ziplayer");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
let tempmess = null;
//====================================================================//

module.exports.data = {
	name: "Search",
	type: "player",
};

//====================================================================//

function validURL(str) {
	try {
		new URL(str);
		return true;
	} catch (err) {
		return false;
	}
}

async function buildImageInWorker(searchPlayer, query) {
	logger.debug("Starting buildImageInWorker");
	return new Promise((resolve, reject) => {
		logger.debug("Creating new worker thread");
		const worker = new Worker("./utility/musicImage.js", {
			workerData: { searchPlayer, query },
		});

		worker.on("message", (arrayBuffer) => {
			logger.debug("Received message from worker");
			try {
				const buffer = Buffer.from(arrayBuffer);
				if (!Buffer.isBuffer(buffer)) {
					throw new Error("Received data is not a buffer");
				}
				const attachment = new AttachmentBuilder(buffer, { name: "search.png" });
				resolve(attachment);
			} catch (error) {
				reject(error);
			} finally {
				worker.postMessage("terminate");
			}
			logger.debug("Message processed successfully");
		});

		worker.on("error", (error) => {
			logger.error(`Worker encountered an error: ${JSON.stringify(error)}`);
			reject(error);
		});

		worker.on("exit", (code) => {
			logger.debug(`Worker exited with code ${code}`);
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
}

//====================================================================//

/**
 * @param { BaseInteraction } interaction
 * @param { string } query
 * @param { langdef } lang
 */
module.exports.execute = async (interaction, query, lang, options = {}) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	logger.debug(`Executing command with query: ${JSON.stringify(query)}`);
	const { client, guild, user } = interaction;
	const voiceChannel = interaction?.member?.voice?.channel ?? options.voice;

	if (!isUserInVoiceChannel(voiceChannel, interaction, lang)) return;
	if (!isBotInSameVoiceChannel(guild, voiceChannel, interaction, lang)) return;
	if (!hasVoiceChannelPermissions(voiceChannel, client, interaction, lang)) return;

	await interaction.deferReply({ withResponse: true }).catch(() => {
		logger.warn("Failed to defer reply");
	});
	const player = getPlayer(guild.id);

	if (validURL(query) || query?.includes("tts: ") || options.assistant) {
		logger.debug("Handling play request");
		return handlePlayRequest(interaction, query, lang, options, player);
	}

	logger.debug("Handling search request");
	return handleSearchRequest(interaction, query, lang);
};

//====================================================================//

function isUserInVoiceChannel(voiceChannel, interaction, lang) {
	if (!voiceChannel) {
		logger.debug("User is not in a voice channel");
		interaction.reply({
			content: lang?.music?.NOvoiceChannel ?? "Bạn chưa tham gia vào kênh thoại",
			ephemeral: true,
		});
		return false;
	}
	return true;
}

function isBotInSameVoiceChannel(guild, voiceChannel, interaction, lang) {
	const voiceMe = guild.members.me.voice?.channel;
	if (voiceMe && voiceMe.id !== voiceChannel.id) {
		logger.debug("Bot is not in the same voice channel");

		interaction.reply({
			content: lang?.music?.NOvoiceMe ?? "Bot đã tham gia một kênh thoại khác",
			ephemeral: true,
		});
		return false;
	}
	return true;
}

function hasVoiceChannelPermissions(voiceChannel, client, interaction, lang) {
	const permissions = voiceChannel.permissionsFor(client.user);
	if (!permissions.has("Connect") || !permissions.has("Speak")) {
		logger.debug("Bot lacks necessary permissions in the voice channel");
		interaction.reply({
			content: lang?.music?.NoPermission ?? "Bot không có quyền tham gia hoặc nói trong kênh thoại này",
			ephemeral: true,
		});
		return false;
	}
	return true;
}

//#region Play Request
/**
 * @param { BaseInteraction } interaction
 * @param { string } query
 * @param { langdef } lang
 * @param {object} options
 * @param {Player} player
 */
async function handlePlayRequest(interaction, query, lang, options, player) {
	try {
		if (!player?.userdata) tempmess = await interaction.editReply({ content: "<a:loading:1151184304676819085> Loading..." });
		const playerConfig = await getPlayerConfig(options, interaction);
		logger.debug(`Player configuration retrieved:  ${JSON.stringify(playerConfig)}`);
		const Player = await getManager().create(interaction.guild.id, {
			...playerConfig,
			userdata: await getQueueMetadata(player, interaction, options, lang),
		});

		if (!Player.connection) await Player.connect(interaction?.member?.voice?.channel ?? options?.voice);
		let reqPlayOK = false;
		if (!!query) reqPlayOK = await Player.play(query, interaction?.user);

		if (!reqPlayOK) throw new Error("Play request failed");

		await cleanUpInteraction(interaction, player);
		logger.debug("Track played successfully");
	} catch (e) {
		console.log(e);
		logger.error(`Error in handlePlayRequest:  ${JSON.stringify(e)}`);
		await handleError(interaction, lang);
	}
}

const DefaultPlayerConfig = {
	selfDeaf: true,
	volume: 50,
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: 50_000,
	leaveOnEnd: true,
	leaveOnEndCooldown: 500_000,
	pauseOnEmpty: true,
	extensions: ["lyricsExt"],
};

async function getPlayerConfig(options, interaction) {
	logger.debug("Starting getPlayerConfig");
	const playerConfig = { ...DefaultPlayerConfig, ...config?.PlayerConfig };

	if (options.assistant) {
		logger.debug("selfDeaf due to assistant option");
		playerConfig.selfDeaf = false;
		playerConfig.extensions.push("voiceExt");
	}

	if (playerConfig.volume === "auto") {
		logger.debug("Volume is set to auto, fetching from database");
		const DataBase = useHooks.get("db");
		playerConfig.volume =
			DataBase ?
				((await DataBase.ZiUser.findOne({ userID: interaction.user.id }))?.volume ?? DefaultPlayerConfig.volume)
			:	DefaultPlayerConfig.volume;
		logger.debug(`Volume set from database or default: ${playerConfig.volume}`);
	}

	logger.debug(`Exiting getPlayerConfig with playerConfig: ${JSON.stringify(playerConfig)}`);
	return playerConfig;
}

async function getQueueMetadata(player, interaction, options, lang) {
	return (
		player?.userdata ?? {
			channel: interaction.channel,
			requestedBy: interaction.user,
			LockStatus: false,
			voiceAssistance: options.assistant && config?.DevConfig?.VoiceExtractor,
			lang: lang || langdef,
			listeners: [interaction?.user],
			lyrcsActive: true,
			focus: options?.focus,
			mess: interaction?.customId !== "S_player_Search" ? tempmess : interaction?.message,
		}
	);
}

async function cleanUpInteraction(interaction, player) {
	logger.debug("Starting cleanUpInteraction");
	if (player?.userdata) {
		logger.debug("Queue metadata exists");
		if (interaction?.customId === "S_player_Search") {
			await interaction.message.delete().catch(() => {
				logger.debug("Failed to delete interaction message");
			});
		}
		await interaction?.deleteReply?.().catch(() => {
			logger.debug("Failed to delete interaction reply");
		});
	} else {
		logger.debug("No queue metadata");
		if (interaction?.customId === "S_player_Search") {
			await interaction?.deleteReply?.().catch(() => {
				logger.debug("Failed to delete interaction reply");
			});
		}
	}
	logger.debug("Exiting cleanUpInteraction");
	return;
}

async function handleError(interaction, lang) {
	logger.debug("Starting handleError");
	const response = { content: lang?.music?.NOres ?? "❌ | Không tìm thấy bài hát", ephemeral: true };
	if (interaction.replied || interaction.deferred) {
		logger.debug("Interaction already replied or deferred");
		try {
			await interaction.editReply(response);
			logger.debug("Edited interaction reply successfully");
		} catch {
			logger.warn("Failed to edit interaction reply, fetching reply");
			const meess = await interaction.fetchReply();
			await meess.edit(response).catch(() => {
				logger.error("Failed to edit fetched reply");
			});
		}
	} else {
		logger.debug("Replying to interaction");
		await interaction.reply(response).catch(() => {
			logger.error("Failed to reply to interaction");
		});
	}
	logger.debug("Exiting handleError");
	return;
}

//#endregion Play Request
//#region Search Track
async function handleSearchRequest(interaction, query, lang) {
	const results = await getManager().search(query, interaction.user);
	logger.debug(`Search results:  ${results?.tracks?.length}`);
	const tracks = filterTracks(results?.tracks);
	logger.debug(`Filtered tracks:  ${tracks?.length}`);

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
}

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
			.setDescription(`Duration: ${track.duration} source: ${track.queryType}`)
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
			time: track.duration,
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
				name: `${i + 1}: ${track?.metadata?.author} - ${track.title.slice(0, 50 - track?.metadata?.author.length)} \`[${track.duration}]\``.slice(
					0,
					99,
				),
				value: ` `,
				inline: false,
			})),
		);
	logger.debug("Search results sent");
	return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {
		logger.debug("Failed to edit reply with search results");
	});
}
//#endregion Search Track
