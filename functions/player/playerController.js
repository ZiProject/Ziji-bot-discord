/**
 * playerController:
 * is url -> playerPlay (playerCreate)\
 * orther -> PlayerSearch
 */
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const logger = useHooks.get("logger");
//====================================================================//
module.exports.data = {
	name: "playerController",
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

//====================================================================//

/**
 * One Discord voice connection must belong to exactly one player (`<guildId>::<channelId>`).
 * A browser-only `web-stream-*` player is never allowed to hold (or compete for) that connection,
 * so before handling a Discord-side request we release any web player still attached to the
 * user's voice channel. Web sessions re-register on the Discord player on their own.
 */
async function releaseWebVoiceConflicts(interaction) {
	const voiceChannel = interaction?.member?.voice?.channel;
	if (!voiceChannel || !interaction.guild) return;
	try {
		const { releaseWebVoiceConflicts: release } = require("../../extensions/routes/stream.js");
		const released = await release?.(voiceChannel.id, `${interaction.guild.id}::${voiceChannel.id}`);
		if (released) logger.debug(`Released ${released} web player(s) holding voice channel ${voiceChannel.id}`);
	} catch (error) {
		logger.warn(`Could not release web players for voice channel ${voiceChannel.id}: ${error?.message || error}`);
	}
}

//====================================================================//

/**
 * @param { import ("discord.js").BaseInteraction } interaction
 * @param { string } query
 * @param { import ("../../lang/vi") } lang
 */
module.exports.execute = async (interaction, query, lang, options = {}) => {
	logger.debug(`Executing Player Controller with query: ${JSON.stringify(query)}`);
	const { client, guild, user } = interaction;

	await interaction.deferReply({ withResponse: true }).catch(() => {
		logger.warn("Failed to defer reply");
	});

	await releaseWebVoiceConflicts(interaction);

	if (validURL(query) || query?.includes("tts: ") || options.assistant) {
		logger.debug("Handling play request");
		await useHooks.get("functions").get("playerPlay")?.execute({ interaction, query, lang, options });
		return;
	}

	logger.debug("Handling search request");
	await useHooks.get("functions").get("PlayerSearch")?.execute({ interaction, query, lang });
	return;
};
