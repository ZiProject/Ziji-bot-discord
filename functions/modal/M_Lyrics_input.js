const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
	name: "M_Lyrics_input",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { fields } = interaction;
	const query = fields.getTextInputValue("search-input");
	await interaction.deferUpdate();
	const Lyrics = useFunctions().get("Lyrics");
	if (!Lyrics) return;

	const queue = useQueue(interaction.guild.id);
	if (!queue) {
		await Lyrics.execute(interaction, { type: "plainLyrics", query, lang });
		return;
	}
	//unsubscribe old lyrics
	const ZiLyrics = queue.metadata.ZiLyrics;
	try {
		if (ZiLyrics?.unsubscribe && typeof ZiLyrics.unsubscribe === "function") {
			ZiLyrics.unsubscribe();
		}
	} catch (error) {
		console.error("Error unsubscribing from lyrics:", error);
	}

	await Lyrics.execute(interaction, { type: "syncedLyrics", query, lang });
	return;
};
