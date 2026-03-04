// data/dungeons/index.js
// Static dungeon tier configuration and floor plan generation.

const SEEDED_RNG = require("../../functions/rpg/seededRng"); // tiny seeded RNG helper

// ─── Tier Config ─────────────────────────────────────────────────────────────

const DUNGEON_TIERS = {
  D: {
    id: "D", name: "Goblin Warren",
    emoji: "🏚️",
    color: 0x95A5A6,
    floors: 5,
    reqLevel: 1,
    staminaCost: 2,         // per floor
    dropQuality: ["common","uncommon"],
    enemyLevelRange: [1, 9],
    description: "A damp cave network overrun by goblins and giant rats.",
  },
  C: {
    id: "C", name: "Cursed Catacombs",
    emoji: "⚰️",
    color: 0x27AE60,
    floors: 10,
    reqLevel: 10,
    staminaCost: 2,
    dropQuality: ["uncommon","rare"],
    enemyLevelRange: [10, 19],
    description: "Ancient burial chambers where the dead refuse to stay buried.",
  },
  B: {
    id: "B", name: "Inferno Spire",
    emoji: "🔥",
    color: 0xE67E22,
    floors: 15,
    reqLevel: 20,
    staminaCost: 3,
    dropQuality: ["rare","epic"],
    enemyLevelRange: [20, 34],
    description: "A volcanic tower crawling with fire demons and lava elementals.",
  },
  A: {
    id: "A", name: "Abyssal Rift",
    emoji: "🌌",
    color: 0x8E44AD,
    floors: 20,
    reqLevel: 35,
    staminaCost: 3,
    dropQuality: ["epic","legendary"],
    enemyLevelRange: [35, 49],
    description: "A crack in reality leading to the void between dimensions.",
  },
  S: {
    id: "S", name: "Titan's Vault",
    emoji: "⚙️",
    color: 0xF39C12,
    floors: 25,
    reqLevel: 50,
    staminaCost: 5,
    dropQuality: ["legendary","mythic"],
    enemyLevelRange: [50, 74],
    description: "The sealed stronghold of the ancient Titans, filled with mechanical guardians.",
  },
  EX: {
    id: "EX", name: "Void Nexus",
    emoji: "🕳️",
    color: 0x1A1A2E,
    floors: 30,
    reqLevel: 75,
    staminaCost: 5,
    requiresSeal: true,     // needs a Dungeon Seal item
    dropQuality: ["mythic","unique"],
    enemyLevelRange: [75, 100],
    description: "The heart of the Void itself. Only the strongest dare enter.",
  },
};

// ─── Floor Type Weights ───────────────────────────────────────────────────────
// These weights are used to randomly determine each floor type.
// Boss floor is always the LAST floor — never in the random pool.

const FLOOR_WEIGHTS = {
  combat:   40,   // standard 1-3 mobs
  elite:    20,   // 1-2 elite mobs
  trap:     10,   // skill-check trap
  puzzle:    8,   // riddle/modal puzzle
  rest:     12,   // recover HP/MP
  treasure:  5,   // free loot
  miniboss:  4,   // mini-boss (no boss skills)
  // 'boss' is always floor N (not randomly assigned)
};

/**
 * Generate a deterministic floor plan for a dungeon run.
 * The last floor is always "boss".
 * The second-to-last is always "miniboss".
 * A "rest" room is guaranteed in the first third.
 *
 * @param {number} totalFloors
 * @param {number} seed  — seeded RNG seed (stored in DungeonRun)
 * @returns {string[]}   — array of floor type strings, length === totalFloors
 */
function generateFloorPlan(totalFloors, seed) {
  const rng   = new SEEDED_RNG(seed);
  const plan  = [];

  // Pre-assign guaranteed floors
  const guaranteedRest   = Math.floor(totalFloors / 3);          // ~1/3 in
  const minibossFloor    = totalFloors - 2;                      // second to last
  const bossFloor        = totalFloors - 1;                      // last (0-indexed)

  // Build the weighted pool (excluding 'boss' and 'miniboss')
  const pool = [];
  for (const [type, weight] of Object.entries(FLOOR_WEIGHTS)) {
    for (let i = 0; i < weight; i++) pool.push(type);
  }

  for (let i = 0; i < totalFloors; i++) {
    if (i === bossFloor)    { plan.push("boss");     continue; }
    if (i === minibossFloor){ plan.push("miniboss"); continue; }
    if (i === guaranteedRest && !plan.includes("rest")) { plan.push("rest"); continue; }

    // Random from weighted pool
    plan.push(pool[Math.floor(rng.next() * pool.length)]);
  }

  return plan;
}

/**
 * Get dungeon config for a tier, throws if invalid.
 * @param {string} tier
 */
function getDungeonConfig(tier) {
  const config = DUNGEON_TIERS[tier];
  if (!config) throw new Error(`Unknown dungeon tier: ${tier}`);
  return config;
}

/**
 * How much stamina does this dungeon tier cost total?
 * @param {string} tier
 * @param {number} floors — optional override
 */
function getTotalStaminaCost(tier, floors = null) {
  const config = getDungeonConfig(tier);
  return config.staminaCost * (floors ?? config.floors);
}

module.exports = { DUNGEON_TIERS, FLOOR_WEIGHTS, generateFloorPlan, getDungeonConfig, getTotalStaminaCost };
