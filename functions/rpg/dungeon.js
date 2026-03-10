// functions/rpg/dungeon.js
// ─────────────────────────────────────────────────────────────────────────────
// DungeonEngine — handles everything outside of combat resolution.
//   • Starting a run           → DungeonEngine.startRun(...)
//   • Advancing a floor        → DungeonEngine.advanceFloor(...)
//   • Handling non-combat rooms→ DungeonEngine.resolveRoom(...)
//   • Finishing a run          → DungeonEngine.finishRun(...)
//
// CombatEngine (combat.js) is called separately for combat phases.
// ─────────────────────────────────────────────────────────────────────────────

const { useHooks } = require("zihooks");
const { Character, DungeonRun } = useHooks.get("db");

const SeededRNG   = require("./seededRng");
const { getDungeonConfig, generateFloorPlan } = require("../../data/dungeons");
const { getNormalMonsters, getEliteMonsters, getBossForTier, scaleMonster } = require("../../data/monsters");
const LootEngine  = require("./lootEngine");

// ─── Stamina costs (floor-level) ─────────────────────────────────────────────
const STAMINA_PER_FLOOR = { D: 2, C: 2, B: 3, A: 3, S: 5, EX: 5 };

class DungeonEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // START RUN
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new dungeon run document.
   *
   * @param {object} opts
   * @param {string}   opts.partyLeaderId
   * @param {string}   opts.guildId
   * @param {string}   opts.channelId
   * @param {string}   opts.tier           — "D"|"C"|"B"|"A"|"S"|"EX"
   * @param {string[]} opts.playerIds      — array of userIds (1–4)
   * @returns {{ run: DungeonRun, error: string|null }}
   */
  static async startRun({ partyLeaderId, guildId, channelId, tier, playerIds }) {
    // ── Validation ──────────────────────────────────────────────────────────
    const config = getDungeonConfig(tier);

    // Load all characters
    const characters = await Promise.all(
      playerIds.map(id => Character.findCharacter(id, guildId))
    );

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const uid  = playerIds[i];

      if (!char)
        return { run: null, error: `<@${uid}> has not created a character yet. Use \`/rpg start\`.` };

      if (char.level < config.reqLevel)
        return { run: null, error: `<@${uid}> must be at least **Level ${config.reqLevel}** for a ${tier}-tier dungeon.` };

      if (config.requiresSeal) {
        const hasSeal = char.inventory.find(i => i.itemId === "dungeon_seal" && i.quantity > 0);
        if (!hasSeal)
          return { run: null, error: `<@${uid}> needs a **Dungeon Seal** to enter the Void Nexus.` };
      }

      // Check stamina
      const staminaNeeded = STAMINA_PER_FLOOR[tier];
      char._regenStamina();
      if (char.stamina < staminaNeeded)
        return { run: null, error: `<@${uid}> doesn't have enough stamina (needs ${staminaNeeded}, has ${char.stamina}).` };

      // Check not already in a run
      const existing = await DungeonRun.findOne({ "players.userId": uid, active: true });
      if (existing)
        return { run: null, error: `<@${uid}> is already in an active dungeon run.` };
    }

    // ── Build player snapshots ───────────────────────────────────────────────
    const players = characters.map(char => ({
      userId:   char.userId,
      name:     char.name,
      class:    char.class,
      level:    char.level,
      hp:       char.stats.hp,
      maxHp:    char.stats.maxHp,
      mp:       char.stats.mp,
      maxMp:    char.stats.maxMp,
      atk:      char.stats.atk,
      def:      char.stats.def,
      spd:      char.stats.spd,
      matk:     char.stats.matk,
      mdef:     char.stats.mdef,
      crit:     char.stats.crit,
      critDmg:  char.stats.critDmg,
      statusEffects: [],
      buffs:    [],
      lootCollected: [],
      xpEarned:  0,
      goldEarned: 0,
      downed:   false,
      escaped:  false,
    }));

    // ── Consume seal for EX ──────────────────────────────────────────────────
    if (config.requiresSeal) {
      for (const char of characters) {
        const sealSlot = char.inventory.find(i => i.itemId === "dungeon_seal");
        sealSlot.quantity--;
        if (sealSlot.quantity === 0)
          char.inventory = char.inventory.filter(i => i.itemId !== "dungeon_seal" || i.quantity > 0);
        await char.save();
      }
    }

    // ── Generate floor plan ──────────────────────────────────────────────────
    const seed      = Date.now() % 2147483647; // 32-bit safe
    const floorPlan = generateFloorPlan(config.floors, seed);

    const run = await DungeonRun.create({
      partyLeaderId,
      guildId,
      channelId,
      players,
      tier,
      dungeonName: config.name,
      totalFloors:  config.floors,
      seed,
      floorPlan,
      currentFloor: 1,
      floorType:    floorPlan[0],
      phase:        floorPlan[0] === "combat" || floorPlan[0] === "elite" || floorPlan[0] === "miniboss" || floorPlan[0] === "boss"
                      ? "combat" : floorPlan[0],
      active: true,
    });

    return { run, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ADVANCE FLOOR
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Move the run to the next floor.
   * Deducts stamina from all alive players.
   * Populates currentEnemies for combat floors.
   * Returns the updated run.
   *
   * @param {DungeonRun} run
   * @param {Character[]} characters — loaded character docs (for stamina)
   * @returns {{ run: DungeonRun, staminaError: string|null }}
   */
  static async advanceFloor(run, characters) {
    // Deduct stamina from alive players
    const cost = STAMINA_PER_FLOOR[run.tier];
    for (const char of characters) {
      const p = run.getPlayer(char.userId);
      if (!p || p.downed || p.escaped) continue;
      if (!char.useStamina(cost)) {
        return {
          run,
          staminaError: `<@${char.userId}> ran out of stamina! The party was forced back.`,
        };
      }
      await char.save();
    }

    const nextFloorIdx = run.currentFloor; // 0-indexed in floorPlan
    if (nextFloorIdx >= run.totalFloors) {
      // Shouldn't happen — finishRun should be called before this
      run.phase  = "complete";
      run.active = false;
      await run.save();
      return { run, staminaError: null };
    }

    run.currentFloor++;
    const floorType = run.floorPlan[nextFloorIdx];
    run.floorType   = floorType;

    // Clear per-floor combat state
    run.currentEnemies  = [];
    run.turnOrder       = [];
    run.currentTurnIdx  = 0;
    run.turnCount       = 0;
    run.comboCounters   = new Map();

    // Clear player status effects each new floor (buffs persist)
    for (const p of run.players) {
      p.statusEffects = [];
    }

    // ── Spawn enemies for combat floors ─────────────────────────────────────
    if (["combat","elite","miniboss","boss"].includes(floorType)) {
      run.currentEnemies = DungeonEngine._spawnEnemies(run, floorType);
      run.turnOrder      = DungeonEngine._buildTurnOrder(run);
      run.phase          = "combat";
    } else {
      run.phase = floorType; // "trap","puzzle","rest","treasure"
    }

    run.updatedAt = new Date();
    await run.save();
    return { run, staminaError: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SPAWN ENEMIES
  // ───────────────────────────────────────────────────────────────────────────

  static _spawnEnemies(run, floorType) {
    const rng   = new SeededRNG(run.seed + run.currentFloor * 1000);
    const floor = run.currentFloor;
    const tier  = run.tier;

    if (floorType === "boss") {
      const boss = getBossForTier(tier);
      if (!boss) return [];
      return [scaleMonster(boss, floor, tier)];
    }

    if (floorType === "miniboss") {
      // Pick a random elite as mini-boss
      const elites = getEliteMonsters(tier);
      if (!elites.length) {
        const normals = getNormalMonsters(tier);
        const m = rng.pick(normals);
        const scaled = scaleMonster(m, floor, tier);
        scaled.hp    = Math.floor(scaled.hp * 2.5);
        scaled.maxHp = scaled.hp;
        scaled.atk   = Math.floor(scaled.atk * 1.5);
        return [scaled];
      }
      return [scaleMonster(rng.pick(elites), floor, tier)];
    }

    if (floorType === "elite") {
      const elites = getEliteMonsters(tier);
      const pool   = elites.length ? elites : getNormalMonsters(tier);
      const count  = rng.nextInt(1, 2);
      return Array.from({ length: count }, () => scaleMonster(rng.pick(pool), floor, tier));
    }

    // Normal combat — 1 to 3 mobs
    const normals = getNormalMonsters(tier);
    const count   = rng.nextInt(1, Math.min(3, run.players.filter(p => !p.downed && !p.escaped).length + 1));
    return Array.from({ length: count }, () => scaleMonster(rng.pick(normals), floor, tier));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BUILD TURN ORDER
  // ───────────────────────────────────────────────────────────────────────────

  /** Sort players + enemies by SPD descending, build turnOrder array */
  static _buildTurnOrder(run) {
    const rng = new SeededRNG(run.seed + run.currentFloor * 999);
    const actors = [];

    for (const p of run.players) {
      if (p.downed || p.escaped) continue;
      actors.push({ id: p.userId, spd: p.spd + rng.nextInt(1, 10) });
    }
    for (let i = 0; i < run.currentEnemies.length; i++) {
      const e = run.currentEnemies[i];
      actors.push({ id: `enemy_${i}`, spd: e.spd + rng.nextInt(1, 10) });
    }

    actors.sort((a, b) => b.spd - a.spd);
    return actors.map(a => a.id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESOLVE NON-COMBAT ROOMS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Handle a non-combat floor room.
   * @param {DungeonRun} run
   * @param {string} userId       — player who triggered the room action
   * @param {object} [input]      — for puzzle/trap: { answer } or { statUsed }
   * @returns {{ result: object, run: DungeonRun }}
   */
  static async resolveRoom(run, userId, input = {}) {
    const player = run.getPlayer(userId);
    const rng    = new SeededRNG(run.seed + run.currentFloor * 777);
    const result = { type: run.floorType, success: false, message: "", rewards: {} };

    switch (run.floorType) {

      case "rest": {
        // Restore 30% HP and MP for all alive players
        const healed = [];
        for (const p of run.alivePlayers()) {
          const hpGain = Math.floor(p.maxHp * 0.30);
          const mpGain = Math.floor(p.maxMp * 0.30);
          p.hp = Math.min(p.maxHp, p.hp + hpGain);
          p.mp = Math.min(p.maxMp, p.mp + mpGain);
          healed.push({ userId: p.userId, hp: hpGain, mp: mpGain });
        }
        result.success = true;
        result.message = "🏕️ The party rests around a campfire. HP and MP restored.";
        result.rewards = { healed };
        break;
      }

      case "treasure": {
        // Roll loot for each alive player
        const loot = [];
        for (const p of run.alivePlayers()) {
          const item = LootEngine.rollFloorLoot(run.tier, run.currentFloor, rng, false);
          if (item) {
            p.lootCollected.push(item.itemId);
            loot.push({ userId: p.userId, item });
          }
        }
        const gold = rng.nextInt(50, 200) * (run.currentFloor);
        for (const p of run.alivePlayers()) p.goldEarned += gold;
        result.success = true;
        result.message = "💰 A treasure chest! The party shares the spoils.";
        result.rewards = { loot, gold };
        break;
      }

      case "trap": {
        // SPD check — DC scales with floor
        const dc     = 10 + run.currentFloor * 2;
        const roll   = player.spd + rng.nextInt(1, 20);
        const passed = roll >= dc;

        if (passed) {
          const gold = rng.nextInt(30, 100) * run.currentFloor;
          player.goldEarned += gold;
          result.message = `🏃 You spotted and dodged the trap! Found **${gold}** gold in the mechanism.`;
          result.rewards = { gold };
        } else {
          const dmg = Math.floor(player.maxHp * 0.20);
          player.hp = Math.max(1, player.hp - dmg);
          result.message = `💥 You triggered the trap! Took **${dmg}** damage.`;
          result.rewards = { damage: dmg };
        }
        result.success = passed;
        break;
      }

      case "puzzle": {
        // Simple number-based puzzle (answer stored in seed-derived target)
        const target = rng.nextInt(1, 20) * rng.nextInt(1, 5);
        const userAnswer = parseInt(input.answer ?? "0", 10);
        const passed = userAnswer === target;

        if (passed) {
          const item = LootEngine.rollFloorLoot(run.tier, run.currentFloor, rng, true);
          if (item) player.lootCollected.push(item.itemId);
          result.message = `🧩 Correct! The hidden mechanism unlocks a **bonus chest**.`;
          result.rewards = { item };
        } else {
          result.message = `❌ Wrong answer. The puzzle resets. (Correct: **${target}**)`;
        }
        result.success = passed;
        result.puzzleAnswer = target; // for display/hint
        break;
      }

      default:
        result.message = "❓ Unknown room type.";
    }

    // Log the floor
    run.floorLog.push({
      floorNumber: run.currentFloor,
      type:        run.floorType,
      outcome:     result.success ? "passed" : "failed",
      goldGained:  result.rewards?.gold ?? 0,
      loot:        result.rewards?.loot?.map(l => l.item?.itemId).filter(Boolean) ?? [],
    });

    run.phase     = "reward";
    run.updatedAt = new Date();
    await run.save();

    return { result, run };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FINISH RUN
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called when the run ends (victory on boss floor OR total party wipe).
   * Distributes XP, gold, and loot to all participant characters.
   *
   * @param {DungeonRun} run
   * @param {boolean} victory
   * @returns {{ summaries: object[], run: DungeonRun }}
   */
  static async finishRun(run, victory) {
    run.active = false;
    run.phase  = victory ? "complete" : "failed";

    const summaries = [];

    for (const p of run.players) {
      if (p.escaped && !victory) continue; // fled before boss — no bonus

      const char = await Character.findCharacter(p.userId, run.guildId);
      if (!char) continue;

      // XP & Gold
      const xpMulti   = victory ? 1.0 : 0.3; // partial XP on defeat
      const goldMulti  = victory ? 1.0 : 0.5;
      const finalXp    = Math.floor(p.xpEarned * xpMulti);
      const finalGold  = Math.floor(p.goldEarned * goldMulti);

      const { leveled, newLevel } = char.awardXP(finalXp);
      char.currency.gold += finalGold;

      // Loot
      const lootAdded = [];
      for (const itemId of p.lootCollected) {
        const slot = char.inventory.find(i => i.itemId === itemId);
        if (slot) slot.quantity++;
        else char.inventory.push({ itemId, quantity: 1 });
        lootAdded.push(itemId);
      }

      // Restore HP/MP to 1 minimum (died in dungeon)
      if (p.downed) {
        char.stats.hp = Math.max(1, Math.floor(char.stats.maxHp * 0.10));
        char.stats.mp = Math.max(0, Math.floor(char.stats.maxMp * 0.10));
      } else {
        // Sync HP/MP back from dungeon state
        char.stats.hp = p.hp;
        char.stats.mp = p.mp;
      }

      // Combat stats
      char.combatStats.dungeonClears += victory ? 1 : 0;

      await char.save();

      summaries.push({
        userId:   p.userId,
        name:     p.name,
        xp:       finalXp,
        gold:     finalGold,
        loot:     lootAdded,
        leveled,
        newLevel: leveled ? newLevel : null,
        downed:   p.downed,
      });
    }

    run.updatedAt = new Date();
    await run.save();

    return { summaries, run };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FLEE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Player attempts to flee. 50% base + SPD bonus vs enemy SPD.
   * On success marks player as escaped. If all players escaped → run ends.
   *
   * @param {DungeonRun} run
   * @param {string} userId
   * @returns {{ success: boolean, run: DungeonRun, runOver: boolean }}
   */
  static async attemptFlee(run, userId) {
    const player = run.getPlayer(userId);
    const rng    = new SeededRNG(Date.now());

    // Average enemy SPD
    const avgEnemySpd = run.currentEnemies.reduce((s, e) => s + e.spd, 0) / (run.currentEnemies.length || 1);
    const fleeChance  = Math.min(0.85, 0.50 + (player.spd - avgEnemySpd) * 0.01);
    const success     = rng.next() < fleeChance;

    if (success) {
      player.escaped = true;
    }

    const runOver = run.alivePlayers().length === 0;
    if (runOver) {
      await DungeonEngine.finishRun(run, false);
    } else {
      run.updatedAt = new Date();
      await run.save();
    }

    return { success, run, runOver };
  }
}

module.exports = DungeonEngine;
