// extensions/rpgFactionInit.js
// Priority 4 — runs after gacha init.
// Sets up DB indexes, starts WarScheduler, and registers daily income cron.

const { useHooks } = require("zihooks");

module.exports.data = {
  name: "RPG Faction Init",
  type: "extension",
  enable: true,
  priority: 4,
};

module.exports.execute = async (client) => {
  const logger = useHooks.get("logger");
  logger.info("[Faction] Initialising faction system...");

  try {
    const mongoose     = require("mongoose");
    const Faction      = require("../models/Faction");
    const FactionWar   = require("../models/FactionWar");
    const FactionEngine = require("../functions/rpg/factionEngine");
    const { WarScheduler } = require("../functions/rpg/factionHandlers");

    // ── MongoDB indexes ─────────────────────────────────────────────────────
    await mongoose.connection.collection("factions").createIndex(
      { guildId: 1, tag: 1 }, { unique: true, background: true }
    );
    await mongoose.connection.collection("factions").createIndex(
      { guildId: 1, powerScore: -1 }, { background: true }
    );
    await mongoose.connection.collection("factionwars").createIndex(
      { guildId: 1, active: 1 }, { background: true }
    );
    await mongoose.connection.collection("factionwars").createIndex(
      { "alpha.factionId": 1, active: 1 }, { background: true }
    );
    await mongoose.connection.collection("factionwars").createIndex(
      { "beta.factionId": 1, active: 1 }, { background: true }
    );

    // ── Attach engines ──────────────────────────────────────────────────────
    client.rpg.factionEngine = FactionEngine;
    client.rpg.warEngine     = require("../functions/rpg/warEngine");

    // ── War Scheduler ───────────────────────────────────────────────────────
    WarScheduler.start(client);

    // ── Daily income cron ───────────────────────────────────────────────────
    // Run at 00:00 UTC every day
    _scheduleDailyIncome(client, logger, FactionEngine, Faction);

    logger.info("[Faction] Faction system ready. ⚔️");
  } catch (err) {
    logger.error("[Faction] Init failed:", err.message);
    logger.error(err.stack);
  }
};

// ─── Daily income scheduler ──────────────────────────────────────────────────
function _scheduleDailyIncome(client, logger, FactionEngine, Faction) {
  const now     = new Date();
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  setTimeout(async () => {
    await _runDailyIncome(logger, FactionEngine, Faction);
    // Then run every 24h
    setInterval(() => _runDailyIncome(logger, FactionEngine, Faction), 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  logger.info(`[Faction] Daily income scheduled — first run in ${Math.round(msUntilMidnight / 60000)} minutes.`);
}

async function _runDailyIncome(logger, FactionEngine, Faction) {
  try {
    const allFactions = await Faction.find({});
    let distributed   = 0;
    for (const faction of allFactions) {
      const income = await FactionEngine.distributeDailyIncome(faction);
      if (income.goldIncome > 0 || income.gemIncome > 0) distributed++;
    }
    logger.info(`[Faction] Daily income distributed to ${distributed} factions.`);
  } catch (err) {
    logger.error("[Faction] Daily income error:", err.message);
  }
}
