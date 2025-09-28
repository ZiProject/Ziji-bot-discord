/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { TicTacToe } = require("discord-gamecord");
module.exports.data = {
	name: "tic-tac-toe",
	description: "Chơi trò chơi cờ caro (tic-tac-toe)",
	type: 1, // slash command
	options: [
		{
			name: "opponent",
			description: "Đối thủ của trò chơi",
			type: 6,
			required: true,
		},
	],
	integration_types: [0],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	const ZiRank = this.functions?.get("ZiRank");
	const Game = new TicTacToe({
		message: interaction,
		isSlashGame: true,
		opponent: interaction.options.getUser("opponent"),
		embed: {
			title: "Trò chơi cờ Caro",
			color: "#ffcc99",
			statusTitle: "Trạng thái",
			overTitle: "Trò chơi kết thúc",
		},
		emojis: {
			xButton: "❌",
			oButton: "🔵",
			blankButton: "➖",
		},
		mentionUser: true,
		timeoutTime: 60000,
		xButtonStyle: "DANGER",
		oButtonStyle: "PRIMARY",
		mentionUser: true,
		timeoutTime: 60000,
		xButtonStyle: "DANGER",
		oButtonStyle: "PRIMARY",
		turnMessage: lang.TicTacToe.turnMessage,
		winMessage: lang.TicTacToe.winMessage,
		tieMessage: lang.TicTacToe.tieMessage,
		timeoutMessage: lang.TicTacToe.timeoutMessage,
		playerOnlyMessage: lang.TicTacToe.playerOnlyMessage,
	});

	Game.startGame();
	Game.on("gameOver", async (result) => {
		const players = [result.player, result.opponent].filter(Boolean);
		if (result.result === "win" && result.winner) {
			const winner = players.find((u) => u.id === result.winner);
			const loser = players.find((u) => u.id !== result.winner);
			await Promise.all([
				ZiRank.execute({ user: winner, XpADD: 0, CoinADD: 100 }),
				ZiRank.execute({ user: loser, XpADD: 0, CoinADD: -100 }),
			]);
		} else if (result.result === "tie") {
			await Promise.all(players.map((u) => ZiRank.execute({ user: u, XpADD: 0, CoinADD: 0 })));
		}
	});
};
