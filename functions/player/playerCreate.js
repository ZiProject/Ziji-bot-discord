const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, BaseInteraction, AttachmentBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const { ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } = require("discord.js");
const langdef = require("../../lang/vi");
const { getPlayer, Player, getManager } = require("ziplayer");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
let tempmess = null;
//====================================================================//

module.exports.data = {
	name: "playerCreate",
	type: "player",
};

/**
 * @param { BaseInteraction } interaction
 * @param { langdef } lang
 * @param { object } options
 */
module.exports.execute = async ({ interaction, lang, options = {} }) => {
	const { client, guild, user } = interaction;
	const voiceChannel = interaction?.member?.voice?.channel ?? options.voice;
	
	await interaction.deferReply({ withResponse: true }).catch(() => {
		logger.warn("Failed to defer reply");
	});

	if (!isUserInVoiceChannel(voiceChannel, interaction, lang)) return;
	if (!isBotInSameVoiceChannel(guild, voiceChannel, interaction, lang)) return;
	if (!hasVoiceChannelPermissions(voiceChannel, client, interaction, lang)) return;


	const player = getPlayer(guild.id);
	return handleCreatePlayer({ interaction, lang, options, player });
};

//====================================================================//

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

function isBotInSameVoiceChannel(guild, voiceChannel, interaction, lang) {
	const voiceMe = guild.members.me.voice?.channel;
	if (voiceMe && voiceMe.id !== voiceChannel.id) {
		logger.debug("Bot is not in the same voice channel");

		interaction.editReply({
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
async function handleCreatePlayer({ interaction, lang, options, player }) {
	try {
		if (!player?.userdata)
			tempmess = await interaction?.editReply({ content: "<a:loading:1151184304676819085> Loading..." }).catch((e) => {
				logger.debug(`Fall for edit loading reply:  ${JSON.stringify(playerConfig)}`);
			});
		const playerConfig = await getPlayerConfig(options, interaction);
		logger.debug(`Player configuration retrieved:  ${JSON.stringify(playerConfig)}`);
		const Player = await getManager().create(interaction.guild.id, {
			...playerConfig,
			userdata: await getQueueMetadata(player, interaction, options, lang),
		});

		if (!Player.connection) await Player.connect(interaction?.member?.voice?.channel ?? options?.voice);
		return Player;
	} catch (e) {
		console.log(e);
		logger.error(`Error in handleCreatePlayer:  ${JSON.stringify(e)}`);
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
	extensions: [
		"lyricsExt",
		// "lavalinkExt"
	],
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
			lyrcsActive: false,
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
		await interaction.editReply(response).catch(() => {
			logger.error("Failed to editReply to interaction");
			await interaction.reply(response).catch(()=> {})
		});
	}
	logger.debug("Exiting handleError");
	return;
}
