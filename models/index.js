const db = require("./mongoDB");
const Character = require("./Character");
const DungeonRun = require("./DungeonRun");
const Faction = require("./Faction");
const FactionWar = require("./FactionWar");
const GachaBanner = require("./GachaBanner");
const GachaPlayer = require("./GachaPlayer");

module.exports = {
	...db,
	...Character,
	...DungeonRun,
	...Faction,
	...FactionWar,
	...GachaBanner,
	...GachaPlayer,
};
