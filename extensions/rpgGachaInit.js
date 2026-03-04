// extensions/rpgGachaInit.js
// Seeds default banners to MongoDB on first boot (idempotent).
// Runs after extensions/rpg.js (priority 3).

const { useHooks } = require("zihooks");

module.exports.data = {
  name: "RPG Gacha Init",
  type: "extension",
  enable: true,
  priority: 3,
};

module.exports.execute = async (client) => {
  const logger = useHooks.get("logger");
  logger.info("[Gacha] Initialising gacha system...");

  try {
    const GachaBanner = require("../models/GachaBanner");
    const { DEFAULT_BANNERS } = require("../data/gacha");

    // Create MongoDB indexes
    const mongoose = require("mongoose");
    const bannColl = mongoose.connection.collection("gachabanners");
    await bannColl.createIndex({ bannerId: 1 }, { unique: true, background: true });
    await bannColl.createIndex({ active: 1 }, { background: true });

    const playerColl = mongoose.connection.collection("gachaplayers");
    await playerColl.createIndex({ userId: 1, guildId: 1 }, { unique: true, background: true });

    // Seed default banners (upsert — won't overwrite existing data)
    for (const bannerData of DEFAULT_BANNERS) {
      await GachaBanner.updateOne(
        { bannerId: bannerData.bannerId },
        { $setOnInsert: bannerData },
        { upsert: true }
      );
    }

    // Attach to client
    client.rpg.gachaEngine  = require("../functions/rpg/gachaEngine");

    logger.info(`[Gacha] Seeded ${DEFAULT_BANNERS.length} default banners. Gacha system ready. 🎰`);
  } catch (err) {
    logger.error("[Gacha] Init failed:", err.message);
    logger.error(err.stack);
  }
};
