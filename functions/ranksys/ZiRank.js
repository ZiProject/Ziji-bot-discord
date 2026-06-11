const { useHooks } = require("zihooks");
const config = useHooks.get("config");

module.exports.data = {
	name: "ZiRank",
	type: "ranksys",
};

module.exports.execute = async ({ user, XpADD = 1, CoinADD = 0 }) => {
	if (!useHooks) return;

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

		const langdef = require(`./../../lang/${lang || config?.DefaultLang}`);
		langdef.color = color;
		return langdef;
	}

	return require(`./../../lang/${config?.DefaultLang}`);
};
