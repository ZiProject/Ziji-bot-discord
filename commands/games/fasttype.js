const { FastType } = require("discord-gamecord");
const { sentence } = require("txtgen/dist/cjs/txtgen.js");
const { useHooks } = require("zihooks");
module.exports.data = {
	name: "fast-type",
	description: "Kiểm tra trình độ gõ của bạn",
	type: 1, // slash command
	integration_types: [0],
	contexts: [0, 1],
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
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
	const ZiRank = useHooks.get("functions").get("ZiRank");
	const sent = sentence();
	const Game = new FastType({
		message: interaction,
		isSlashGame: true,
		embed: {
			title: "Fast Type",
			color: "#5865F2",
			description: "You have {time} seconds to type the sentence below.",
		},
		timeoutTime: 120000,
		sentence: sent,
		winMessage: "Bạn đã thắng với thời gian là {time} giây và wpm là {wpm}.",
		loseMessage: "Bạn đã thua!",
	});

	Game.startGame();
	Game.on("gameOver", async (result) => {
		const CoinADD = result.result === "win" ? 100 : -100;
		await ZiRank.execute({ user: interaction.user, XpADD: 0, CoinADD });
	});
};
