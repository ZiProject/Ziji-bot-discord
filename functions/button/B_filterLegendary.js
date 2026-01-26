const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_filterLegendary",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
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
	// Tạo một đối tượng tương tác mới với bộ lọc legendary
	const newInteraction = {
		...interaction,
		options: {
			getUser: () => null,
			getString: (key) => (key === "rarity" ? "legendary" : null),
		},
	};

	const Command = useHooks.get("commands");
	return Command.get("zoo").execute({ interaction: newInteraction, lang });
};
