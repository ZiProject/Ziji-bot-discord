// data/factions/index.js

// ─── Territory Definitions ────────────────────────────────────────────────────
// Each territory provides a passive bonus to ALL members of the controlling faction.

const TERRITORIES = {

  // ── Mines (Gold/Token income) ──────────────────────────────────────────────
  iron_mine: {
    id: "iron_mine", name: "Iron Mine", emoji: "⛏️",
    type: "mine", bonusType: "gold_income", bonusValue: 200,
    description: "Grants +200 gold/day to the faction treasury.",
    defenseBase: 800,
    captureScore: 500, // score required to capture
  },
  crystal_vein: {
    id: "crystal_vein", name: "Crystal Vein", emoji: "💎",
    type: "mine", bonusType: "gem_income", bonusValue: 50,
    description: "Grants +50 gems/day to all members.",
    defenseBase: 1500,
    captureScore: 1000,
  },
  mana_spring: {
    id: "mana_spring", name: "Mana Spring", emoji: "🔮",
    type: "mine", bonusType: "token_income", bonusValue: 100,
    description: "Grants +100 faction tokens/day.",
    defenseBase: 1200,
    captureScore: 800,
  },

  // ── Fortresses (Combat power) ─────────────────────────────────────────────
  northern_keep: {
    id: "northern_keep", name: "Northern Keep", emoji: "🏰",
    type: "fortress", bonusType: "atk_bonus", bonusValue: 0.05,
    description: "+5% ATK for all members in dungeons and wars.",
    defenseBase: 2000,
    captureScore: 1500,
  },
  iron_citadel: {
    id: "iron_citadel", name: "Iron Citadel", emoji: "⚙️",
    type: "fortress", bonusType: "def_bonus", bonusValue: 0.05,
    description: "+5% DEF and MDEF for all members.",
    defenseBase: 2500,
    captureScore: 2000,
  },
  war_fortress: {
    id: "war_fortress", name: "War Fortress", emoji: "🛡️",
    type: "fortress", bonusType: "war_power", bonusValue: 0.10,
    description: "+10% all stats during faction wars.",
    defenseBase: 3000,
    captureScore: 2500,
  },

  // ── Shrines (XP / skill bonuses) ──────────────────────────────────────────
  ancient_shrine: {
    id: "ancient_shrine", name: "Ancient Shrine", emoji: "⛩️",
    type: "shrine", bonusType: "xp_bonus", bonusValue: 0.10,
    description: "+10% XP from all sources.",
    defenseBase: 1000,
    captureScore: 700,
  },
  spirit_altar: {
    id: "spirit_altar", name: "Spirit Altar", emoji: "🌟",
    type: "shrine", bonusType: "skill_cd_reduce", bonusValue: 1,
    description: "All skill cooldowns reduced by 1 turn (min 1).",
    defenseBase: 2200,
    captureScore: 1800,
  },

  // ── Markets (Economy) ────────────────────────────────────────────────────
  trade_hub: {
    id: "trade_hub", name: "Trade Hub", emoji: "🏪",
    type: "market", bonusType: "shop_discount", bonusValue: 0.10,
    description: "10% discount at all in-game shops.",
    defenseBase: 900,
    captureScore: 600,
  },
  black_market: {
    id: "black_market", name: "Black Market", emoji: "🕵️",
    type: "market", bonusType: "loot_bonus", bonusValue: 0.15,
    description: "+15% loot drop rate in dungeons.",
    defenseBase: 1800,
    captureScore: 1400,
  },

  // ── Dungeon Gates (Dungeon bonuses) ───────────────────────────────────────
  void_gate: {
    id: "void_gate", name: "Void Gate", emoji: "🌀",
    type: "dungeon_gate", bonusType: "stamina_reduce", bonusValue: 1,
    description: "All dungeon stamina costs -1 (min 1).",
    defenseBase: 2800,
    captureScore: 2200,
  },
  dragon_lair: {
    id: "dragon_lair", name: "Dragon Lair", emoji: "🐉",
    type: "dungeon_gate", bonusType: "boss_dmg", bonusValue: 0.10,
    description: "+10% damage to all dungeon bosses.",
    defenseBase: 3500,
    captureScore: 3000,
  },
};

// ─── Hall Upgrades ────────────────────────────────────────────────────────────
// Each can be upgraded up to Level 10. Cost scales per level.

const HALL_UPGRADES = {
  barracks: {
    id: "barracks", name: "Barracks", emoji: "⚔️",
    description: "Increases max member capacity.",
    effectPerLevel: "Max members +2 per level",
    baseCost: { gold: 1000, tokens: 50 },
    costScaling: 1.8,
    maxLevel: 10,
  },
  forge: {
    id: "forge", name: "Faction Forge", emoji: "🔨",
    description: "Reduces crafting costs for all members.",
    effectPerLevel: "-5% crafting cost per level",
    baseCost: { gold: 800, tokens: 40 },
    costScaling: 1.8,
    maxLevel: 10,
  },
  vault: {
    id: "vault", name: "Treasury Vault", emoji: "🏛️",
    description: "Increases faction gold capacity and daily income.",
    effectPerLevel: "+500 gold/day per level",
    baseCost: { gold: 1200, tokens: 60 },
    costScaling: 2.0,
    maxLevel: 10,
  },
  war_room: {
    id: "war_room", name: "War Room", emoji: "🗺️",
    description: "Reduces war cooldown and improves relay battle stats.",
    effectPerLevel: "-4h war cooldown per level, +2% war stats",
    baseCost: { gold: 1500, tokens: 80 },
    costScaling: 2.0,
    maxLevel: 10,
  },
  watchtower: {
    id: "watchtower", name: "Watchtower", emoji: "🗼",
    description: "Increases territory defense scores.",
    effectPerLevel: "+10% territory defense per level",
    baseCost: { gold: 900, tokens: 45 },
    costScaling: 1.9,
    maxLevel: 10,
  },
  summoning_circle: {
    id: "summoning_circle", name: "Summoning Circle", emoji: "🔯",
    description: "Reduces gacha cost for all members.",
    effectPerLevel: "-10 gem cost per pull per level (min 200)",
    baseCost: { gold: 2000, tokens: 100 },
    costScaling: 2.2,
    maxLevel: 5,
  },
  dungeon_portal: {
    id: "dungeon_portal", name: "Dungeon Portal", emoji: "🌀",
    description: "Increases dungeon loot quality.",
    effectPerLevel: "+1 rarity tier chance per level",
    baseCost: { gold: 1800, tokens: 90 },
    costScaling: 2.1,
    maxLevel: 5,
  },
};

// ─── War Rewards ──────────────────────────────────────────────────────────────

const WAR_REWARDS = {
  winner: {
    factionXp:    5000,
    factionGold:  3000,
    memberGems:   300,
    memberTokens: 500,
    territory:    true, // winners capture contested territory
  },
  loser: {
    factionXp:    1000,
    factionGold:  500,
    memberGems:   50,
    memberTokens: 100,
    territory:    false,
  },
  draw: {
    factionXp:    2000,
    factionGold:  1000,
    memberGems:   100,
    memberTokens: 200,
    territory:    false,
  },
  // Individual war MVP (top damage dealer)
  mvp: {
    gems:   200,
    tokens: 300,
    title:  "title_war_hero",
  },
};

// ─── Relay Battle Config ──────────────────────────────────────────────────────

const RELAY_CONFIG = {
  rosterSize:     5,      // 5v5
  rounds:         5,      // each player fights once per round
  preparationTime: 15,    // minutes to assemble roster
  roundTimeLimit:  5,     // minutes per relay battle round
  // Score per round:
  scoreWin:       3,
  scoreDraw:      1,
  scoreLoss:      0,
  // Bonus score for territory siege damage
  siegeScorePerK: 1,      // 1 score per 1000 siege damage
};

// ─── War Cooldown ─────────────────────────────────────────────────────────────
// Hours after a war ends before the faction can fight again.
// Reduced by War Room upgrade level.

const BASE_WAR_COOLDOWN_HOURS = 48;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTerritory(id) {
  return TERRITORIES[id] ?? null;
}

function getHallUpgrade(id) {
  return HALL_UPGRADES[id] ?? null;
}

/**
 * Calculate hall upgrade cost at a given level.
 * @param {string} upgradeId
 * @param {number} currentLevel — level BEFORE upgrade
 */
function getUpgradeCost(upgradeId, currentLevel) {
  const upg = HALL_UPGRADES[upgradeId];
  if (!upg) return null;
  return {
    gold:   Math.floor(upg.baseCost.gold   * Math.pow(upg.costScaling, currentLevel)),
    tokens: Math.floor(upg.baseCost.tokens * Math.pow(upg.costScaling, currentLevel)),
  };
}

/**
 * Get war cooldown hours factoring in War Room upgrade level.
 * @param {number} warRoomLevel
 */
function getWarCooldownHours(warRoomLevel) {
  return Math.max(12, BASE_WAR_COOLDOWN_HOURS - warRoomLevel * 4);
}

module.exports = {
  TERRITORIES, HALL_UPGRADES, WAR_REWARDS, RELAY_CONFIG,
  BASE_WAR_COOLDOWN_HOURS,
  getTerritory, getHallUpgrade, getUpgradeCost, getWarCooldownHours,
};
