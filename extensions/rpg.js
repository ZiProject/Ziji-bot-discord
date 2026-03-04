// extensions/rpg.js
// Runs once at bot startup (priority 2).
// Creates MongoDB indexes and seeds required static data.

const { useHooks } = require("zihooks");

module.exports.data = {
  name: "RPG System Init",
  type: "extension",
  enable: true,
  priority: 2,
};

module.exports.execute = async (client) => {
  const logger = useHooks.get("logger");
  const db     = useHooks.get("db");

  logger.info("[RPG] Initialising RPG system...");

  try {
    // ── Ensure Mongoose models are registered ──────────────────────────────
    require("../models/Character");
    require("../models/DungeonRun");

    // ── Create indexes via Mongoose (idempotent) ───────────────────────────
    const mongoose = require("mongoose");

    // Character indexes
    const charColl = mongoose.connection.collection("characters");
    await charColl.createIndex({ userId: 1, guildId: 1 }, { unique: true, background: true });
    await charColl.createIndex({ "currency.gold": -1 }, { background: true });
    await charColl.createIndex({ level: -1 }, { background: true });
    await charColl.createIndex({ factionId: 1 }, { background: true, sparse: true });

    // DungeonRun indexes
    const dungColl = mongoose.connection.collection("dungeonruns");
    await dungColl.createIndex({ partyLeaderId: 1, active: 1 }, { background: true });
    await dungColl.createIndex({ "players.userId": 1, active: 1 }, { background: true });
    await dungColl.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }); // TTL

    logger.info("[RPG] MongoDB indexes created successfully.");

    // ── Attach RPG helpers to client for easy access ───────────────────────
    const DungeonEngine = require("../functions/rpg/dungeon");
    const { CombatEngine } = require("../functions/rpg/combat");
    const LootEngine    = require("../functions/rpg/lootEngine");

    client.rpg = {
      dungeon: DungeonEngine,
      combat:  CombatEngine,
      loot:    LootEngine,
    };

    logger.info("[RPG] RPG System ready. ⚔️");

  } catch (err) {
    logger.error("[RPG] Init failed:", err.message);
    logger.error(err.stack);
  }
};
