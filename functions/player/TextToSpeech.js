const { useHooks } = require("zihooks");

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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	try {
		const query = `tts:${lang?.name ?? "vi"}: ${context}`;
		useHooks.get("functions").get("Search").execute(interaction, query, lang, options);
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
