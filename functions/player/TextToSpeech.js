const { useFunctions } = require("@zibot/zihooks");
const { getPlayer } = require("ziplayer");

const DefaultPlayerConfig = {
	selfDeaf: false,
	volume: 100,
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: 50_000,
	leaveOnEnd: true,
	leaveOnEndCooldown: 500_000,
	pauseOnEmpty: true,
};

//====================================================================//
/**
 * @param { import ("discord.js").BaseInteraction } interaction
 * @param { String } context
 * @param { langdef } lang
 */
module.exports.execute = async (interaction, context, lang, options = { assistant: true }) => {
	try {
		const player = getPlayer(interaction.guild.id);
		const query = `tts: ${context}`;
		useFunctions().get("Search").execute(interaction, query, lang, options);
		return;
	} catch (e) {
		console.error(e);
		return;
	}
};

//====================================================================//
module.exports.data = {
	name: "TextToSpeech",
	type: "player",
};
