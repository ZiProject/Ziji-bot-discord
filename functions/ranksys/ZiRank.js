const { useHooks } = require("zihooks");
const config = useHooks.get("config");

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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const DataBase = useHooks.get("db");
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
