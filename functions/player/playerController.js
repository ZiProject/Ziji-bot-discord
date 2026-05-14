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

	if (validURL(query) || query?.includes("tts: ") || options.assistant) {
		logger.debug("Handling play request");
		await useHooks.get("functions").get("playerPlay")?.execute({ interaction, query, lang, options });
		return;
	}

	logger.debug("Handling search request");
	await useHooks.get("functions").get("PlayerSearch")?.execute({ interaction, query, lang });
	return;
};
