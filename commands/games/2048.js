const { TwoZeroFourEight } = require("discord-gamecord");
const icons = require("../../utility/icon");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "2048",
	description: "Trò chơi giải đố",
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

	const functions = useHooks.get("functions");
	if (!functions) {
		return interaction.reply({ content: "Hệ thống đang bảo trì, vui lòng thử lại sau.", ephemeral: true });
	}

	const ZiRank = functions.get("ZiRank");
	if (!ZiRank) {
		return interaction.reply({ content: "Chức năng ZiRank không khả dụng.", ephemeral: true });
	}
	const Game = new TwoZeroFourEight({
		message: interaction,
		isSlashGame: true,
		embed: {
			title: "2048",
			color: "#5865F2",
		},
		emojis: {
			up: `${icons.up}`,
			down: `${icons.down}`,
			left: `${icons.left}`,
			right: `${icons.right}`,
		},
		timeoutTime: 60000,
		buttonStyle: "SECONDARY",
		playerOnlyMessage: "Only {player} can use these buttons.",
	});

	Game.startGame();
	Game.on("gameOver", async (result) => {
		const CoinADD = result.result === "win" ? 100 : -100;
		await ZiRank.execute({ user: interaction.user, XpADD: 0, CoinADD });
	});
};
