const { EmbedBuilder, ActionRowBuilder, Client, ButtonBuilder, BaseInteraction, AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } = require("discord.js");
const langdef = require("../../lang/vi");
const { getPlayer, Player, getManager } = require("ziplayer");
const config = useHooks.get("config");
const logger = useHooks.get("logger");

/**
 * @param { object } base
 * @param { BaseInteraction } base.interaction
 * @param { langdef } base.lang
 * @param { object } base.options
 */
async function execute({ interaction, lang, options = {} }) {
	const { client, guild, user } = interaction;
	const voiceChannel = interaction?.member?.voice?.channel ?? options.voice;

	await interaction.deferReply({ withResponse: true }).catch(() => {
		logger.warn("Failed to defer reply");
	});

	if (!isUserInVoiceChannel(voiceChannel, interaction, lang)) return;

	const player = getPlayer(`${guild.id}::${voiceChannel.id}`);
	let tempmess = null;

	if (!player?.userdata)
		tempmess = await interaction?.editReply({ content: "<a:loading:1151184304676819085> Loading..." }).catch((e) => {
			logger.debug(`Fall for edit loading reply`);
		});
	const messs = await interaction.channel.messages.fetch(tempmess);
	// console.log(messs);
	return await createPlayer({
		guildId: interaction.guild.id,
		voiceChannelId: interaction.member.voice.channel.id,
		textChannel: interaction.channel,
		requestedBy: interaction.user,
		lang,
		options,
		reply: interaction,
		message: messs ?? player?.userdata?.mess,
		customId: interaction.customId,
	});
}

//====================================================================//

/**
 * @param { object } base
 * @param { BaseInteraction } base.interaction
 * @param { langdef } base.lang
 * @param { object } base.options
 * @returns { Client }
 */
async function getBot({ guildId, voiceChannelId, reply, lang }) {
	const playerNetClient = useHooks.get("playerNetClient");

	if (!playerNetClient?.length) return false;

	for (const bot of playerNetClient) {
		try {
			const guild = await bot.guilds.fetch(guildId).catch(() => null);

			if (!guild) continue;

			let member = guild.members.me;

			if (!member) {
				member = await guild.members.fetchMe().catch(() => null);
			}

			if (!member) continue;

			const joinedChannelId = member.voice?.channelId;

			if (!joinedChannelId) {
				return bot;
			}

			if (joinedChannelId === voiceChannelId) {
				return bot;
			}
		} catch (e) {
			logger.debug(`getBot fail: ${e.message}`);
		}
	}

	if (reply?.editReply) {
		await reply
			.editReply({
				content: lang?.music?.NOvoiceMe ?? "Bot đã tham gia một kênh thoại khác",
				ephemeral: true,
			})
			.catch(() => {});
	}

	return false;
}

function isUserInVoiceChannel(voiceChannel, interaction, lang) {
	if (!voiceChannel) {
		logger.debug("User is not in a voice channel");
		interaction.editReply({
			content: lang?.music?.NOvoiceChannel ?? "Bạn chưa tham gia vào kênh thoại",
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
		interaction.editReply({
			content: lang?.music?.NoPermission ?? "Bot không có quyền tham gia hoặc nói trong kênh thoại này",
			ephemeral: true,
		});
		return false;
	}
	return true;
}

//#region Play Create
/**
 * @param { object } CreatePlayer
 * @param { BaseInteraction } CreatePlayer.interaction
 * @param { langdef } CreatePlayer.lang
 * @param { object } CreatePlayer.options
 * @param { Player } CreatePlayer.player
 */
async function createPlayer({ guildId, voiceChannelId, textChannel, requestedBy, lang, options = {}, reply, message, customId }) {
	try {
		const PlayerClient = await getBot({
			guildId,
			voiceChannelId,
			reply,
			lang,
		});

		if (!PlayerClient) return;

		const voiceChannel = await PlayerClient.channels.fetch(voiceChannelId);

		if (!hasVoiceChannelPermissions(voiceChannel, PlayerClient, reply, lang)) {
			return;
		}

		const player = getPlayer(`${guildId}::${voiceChannelId}`);

		const playerConfig = await getPlayerConfig(options, requestedBy.id);

		const PlayerInstance = await getManager().create(`${guildId}::${voiceChannelId}`, {
			...playerConfig,
			group: PlayerClient.user.id,
			userdata: player?.userdata ?? {
				channel: textChannel,
				voiceChannel,
				client: PlayerClient,
				requestedBy,
				LockStatus: false,
				voiceAssistance: options.assistant && config?.DevConfig?.VoiceExtractor,
				useAI: options?.useAI || false,
				lang: lang || langdef,
				listeners: [requestedBy],
				lyrcsActive: false,
				focus: options?.focus,
				mess: message,
			},
		});

		if (!PlayerInstance.connection) {
			await PlayerInstance.connect(voiceChannel, {
				group: PlayerClient.user.id,
			});
		}

		return PlayerInstance;
	} catch (e) {
		logger.error(`Error in createPlayer: ${e.stack || e}`);
		throw e;
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
	extensions: [
		"lyricsExt",
		// "lavalinkExt"
	],
};

async function getPlayerConfig(options, userID) {
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
			DataBase ? ((await DataBase.ZiUser.findOne({ userID }))?.volume ?? DefaultPlayerConfig.volume) : DefaultPlayerConfig.volume;
		logger.debug(`Volume set from database or default: ${playerConfig.volume}`);
	}

	logger.debug(`Exiting getPlayerConfig with playerConfig: ${JSON.stringify(playerConfig)}`);
	return playerConfig;
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
		await interaction.editReply(response).catch(() => {
			logger.error("Failed to editReply to interaction");
			interaction.reply(response).catch(() => {});
		});
	}
	logger.debug("Exiting handleError");
	return;
}

//====================================================================//
//====================================================================//
module.exports = {
	data: {
		name: "playerCreate",
		type: "player",
	},
	execute,
	createPlayer,
};
//====================================================================//
//====================================================================//
