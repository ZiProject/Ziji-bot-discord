const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const path = require("path");

function getLang(lang) {
	const defaultLang = config?.DefaultLang || "en";
	const selectedLang = lang || defaultLang;

	try {
		return require(path.join(__dirname, "..", "..", "lang", selectedLang));
	} catch {
		return require(path.join(__dirname, "..", "..", "lang", defaultLang));
	}
}

module.exports.data = {
	name: "ZiRank",
	type: "ranksys",
};

module.exports.execute = async ({ user, XpADD = 1, CoinADD = 0 }) => {
	if (!useHooks) return;
	try {
		const DataBase = useHooks.get("db");
		if (DataBase && user) {
			const userData = (await DataBase.ZiUser.findOne({ userID: user.id })) || {};

			const xp = userData.xp ?? 1;
			const level = userData.level ?? 1;
			const coin = userData.coin ?? 0;
			const { lang, color } = userData;

			let newXp = xp + XpADD;
			let newLevel = level;
			let newCoin = coin + CoinADD;

			const xpThreshold = newLevel * 50 + 1;
			if (newXp > xpThreshold) {
				newLevel += 1;
				newXp = 1;
				newCoin += newLevel * 100;
			}

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

			const langdef = getLang(lang);

			langdef.color = color;
			return langdef;
		}
	} catch (error) {
		console.error("Error in ZiRank:", error);
	}

	return getLang(config?.DefaultLang || "en");
};
