const { useHooks } = require("zihooks");

module.exports.data = {
	name: "M_player_search",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const { guild, client, fields } = interaction;
	const query = fields.getTextInputValue("search-input");
	const command = useHooks.get("functions").get("Search");
	await command.execute(interaction, query, lang);
};
