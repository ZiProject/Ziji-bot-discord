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

const config = this.config;

module.exports.data = {
	name: "ZiRank",
	type: "ranksys",
};

/**
 * @param { import ("discord.js").User } user
 * @param { Number } XpADD
 * @param { Number } CoinADD
 */

module.exports.execute = async ({ user, XpADD = 1, CoinADD = 0 }) => {
	const DataBase = this.db;
	if (DataBase && user) {
		// Destructure userDB to extract values with default assignments
		const { xp = 1, level = 1, coin = 1, lang, color } = (await DataBase.ZiUser.findOne({ userID: user.id })) || {};

		// Calculate new xp
		let newXp = xp + XpADD;
		let newLevel = level;
		let newCoin = coin + CoinADD;

		// Level up if the new xp exceeds the threshold
		const xpThreshold = newLevel * 50 + 1;
		if (newXp > xpThreshold) {
			newLevel += 1;
			newXp = 1;
			newCoin += newLevel * 100;
		}

		// Update the user in the database
		await DataBase.ZiUser.updateOne(
			{ userID: user.id },
			{
				$set: {
					xp: newXp,
					level: newLevel,
					coin: newCoin,
				},
			},
			{ upsert: true },
		);
		const langdef = require(`./../../lang/${lang || config?.DeafultLang}`);
		langdef.color = color;
		return langdef;
	} else {
		// If the database is not available, just increment the user's XP and Coin
		const langdef = require(`./../../lang/${config?.DeafultLang}`);
		return langdef;
	}
};
