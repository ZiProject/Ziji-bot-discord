//  data/monsters/index.js
//  Static monster definitions keyed by monsterId.
//  Stats listed are BASE values — DungeonEngine scales them by floor & tier.
//
//  fields:
//    id, name, emoji, tier (min dungeon tier), type, element, weakness[],
//    baseStats: { hp, atk, def, spd, matk, mdef },
//    skills: string[]  (ids resolved by CombatEngine),
//    lootTable: [{ itemId, weight, minQty, maxQty }],
//    xpReward, goldMin, goldMax,
//    isElite, isBoss, description

const MONSTERS = {

  // ══════════════════════════════════════════════════════════════════════
  // TIER D — Goblin Warren (Lv 1–9)
  // ══════════════════════════════════════════════════════════════════════

  goblin_grunt: {
    id: "goblin_grunt", name: "Goblin Grunt", emoji: "👺", tier: "D",
    type: "humanoid", element: "none", weakness: ["fire","light"],
    baseStats: { hp: 60, atk: 12, def: 5, spd: 11, matk: 0, mdef: 3 },
    skills: ["m_strike"],
    lootTable: [
      { itemId: "iron_ore",    weight: 40, minQty: 1, maxQty: 2 },
      { itemId: "goblin_ear",  weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "copper_coin", weight: 20, minQty: 5, maxQty: 15 },
      { itemId: "common_sword",weight: 10, minQty: 1, maxQty: 1 },
    ],
    xpReward: 18, goldMin: 8, goldMax: 20,
    isElite: false, isBoss: false,
    description: "A scrawny goblin footsoldier armed with a rusty dagger.",
  },

  goblin_shaman: {
    id: "goblin_shaman", name: "Goblin Shaman", emoji: "🧙", tier: "D",
    type: "humanoid", element: "fire", weakness: ["water","ice"],
    baseStats: { hp: 45, atk: 6, def: 3, spd: 9, matk: 18, mdef: 8 },
    skills: ["m_firebolt", "m_hex"],
    lootTable: [
      { itemId: "fire_shard",  weight: 35, minQty: 1, maxQty: 2 },
      { itemId: "goblin_totem",weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "herb_red",    weight: 30, minQty: 1, maxQty: 3 },
      { itemId: "staff_crude", weight: 15, minQty: 1, maxQty: 1 },
    ],
    xpReward: 22, goldMin: 10, goldMax: 25,
    isElite: false, isBoss: false,
    description: "A goblin shaman wielding primitive fire magic.",
  },

  giant_rat: {
    id: "giant_rat", name: "Giant Rat", emoji: "🐀", tier: "D",
    type: "beast", element: "none", weakness: ["fire","lightning"],
    baseStats: { hp: 40, atk: 10, def: 4, spd: 16, matk: 0, mdef: 2 },
    skills: ["m_bite", "m_gnaw"],
    lootTable: [
      { itemId: "rat_fang",    weight: 50, minQty: 1, maxQty: 2 },
      { itemId: "rat_pelt",    weight: 35, minQty: 1, maxQty: 1 },
      { itemId: "herb_green",  weight: 15, minQty: 1, maxQty: 2 },
    ],
    xpReward: 14, goldMin: 3, goldMax: 10,
    isElite: false, isBoss: false,
    description: "A massive rodent infesting the dungeon's lower passages.",
  },

  // ─── Tier D Elite ───────────────────────────────────────────────────
  goblin_warchief: {
    id: "goblin_warchief", name: "Goblin Warchief", emoji: "👹", tier: "D",
    type: "humanoid", element: "none", weakness: ["fire","light"],
    baseStats: { hp: 180, atk: 22, def: 12, spd: 12, matk: 5, mdef: 8 },
    skills: ["m_strike", "m_war_cry", "m_shield_bash"],
    lootTable: [
      { itemId: "warchief_axe",   weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "goblin_crown",   weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "uncommon_chest", weight: 40, minQty: 1, maxQty: 1 },
      { itemId: "gold_pouch",     weight: 20, minQty: 1, maxQty: 1 },
    ],
    xpReward: 90, goldMin: 40, goldMax: 80,
    isElite: true, isBoss: false,
    description: "The brutal leader of the goblin tribe. Commands respect through fear.",
  },

  // ─── Tier D Boss ────────────────────────────────────────────────────
  cave_troll: {
    id: "cave_troll", name: "Cave Troll King", emoji: "🗿", tier: "D",
    type: "giant", element: "earth", weakness: ["fire","lightning"],
    baseStats: { hp: 500, atk: 35, def: 20, spd: 6, matk: 5, mdef: 10 },
    skills: ["m_ground_slam", "m_rock_throw", "m_regen", "m_enrage"],
    lootTable: [
      { itemId: "troll_hide",    weight: 40, minQty: 2, maxQty: 4 },
      { itemId: "earth_core",    weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "rare_chest",    weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "troll_club",    weight: 15, minQty: 1, maxQty: 1 },
    ],
    xpReward: 250, goldMin: 100, goldMax: 200,
    isElite: false, isBoss: true,
    description: "An ancient troll that claims the deepest cave as his throne room.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // TIER C — Cursed Catacombs (Lv 10–19)
  // ══════════════════════════════════════════════════════════════════════

  skeleton_warrior: {
    id: "skeleton_warrior", name: "Skeleton Warrior", emoji: "💀", tier: "C",
    type: "undead", element: "dark", weakness: ["light","fire"],
    baseStats: { hp: 110, atk: 28, def: 14, spd: 10, matk: 0, mdef: 5 },
    skills: ["m_strike", "m_bone_shield"],
    lootTable: [
      { itemId: "bone_shard",    weight: 45, minQty: 1, maxQty: 3 },
      { itemId: "rusted_sword",  weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "dark_essence",  weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "uncommon_armor",weight: 10, minQty: 1, maxQty: 1 },
    ],
    xpReward: 45, goldMin: 20, goldMax: 45,
    isElite: false, isBoss: false,
    description: "A skeletal warrior animated by dark magic, wielding a rusted sword.",
  },

  cursed_spirit: {
    id: "cursed_spirit", name: "Cursed Spirit", emoji: "👻", tier: "C",
    type: "undead", element: "dark", weakness: ["light"],
    baseStats: { hp: 80, atk: 8, def: 6, spd: 18, matk: 32, mdef: 15 },
    skills: ["m_soul_drain", "m_curse", "m_phase"],
    lootTable: [
      { itemId: "ectoplasm",     weight: 40, minQty: 1, maxQty: 2 },
      { itemId: "dark_shard",    weight: 30, minQty: 1, maxQty: 2 },
      { itemId: "spirit_orb",    weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "rare_accessory",weight: 10, minQty: 1, maxQty: 1 },
    ],
    xpReward: 55, goldMin: 25, goldMax: 55,
    isElite: false, isBoss: false,
    description: "A tormented spirit that drains the life force of the living.",
  },

  // ─── Tier C Boss ────────────────────────────────────────────────────
  lich_apprentice: {
    id: "lich_apprentice", name: "Lich Apprentice", emoji: "🧟", tier: "C",
    type: "undead", element: "dark", weakness: ["light","fire"],
    baseStats: { hp: 900, atk: 20, def: 15, spd: 14, matk: 65, mdef: 30 },
    skills: ["m_death_bolt","m_raise_dead","m_curse","m_dark_nova","m_bone_armor"],
    lootTable: [
      { itemId: "phylactery_shard", weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "dark_grimoire",    weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "epic_chest",       weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "lich_robe",        weight: 10, minQty: 1, maxQty: 1 },
      { itemId: "dark_crystal",     weight: 25, minQty: 2, maxQty: 4 },
    ],
    xpReward: 600, goldMin: 250, goldMax: 500,
    isElite: false, isBoss: true,
    description: "A student of death magic who has partially completed the transformation into a Lich.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // TIER B — Inferno Spire (Lv 20–34)
  // ══════════════════════════════════════════════════════════════════════

  flame_demon: {
    id: "flame_demon", name: "Flame Demon", emoji: "😈", tier: "B",
    type: "demon", element: "fire", weakness: ["water","ice"],
    baseStats: { hp: 200, atk: 45, def: 18, spd: 16, matk: 40, mdef: 12 },
    skills: ["m_fireball", "m_flame_breath", "m_ignite"],
    lootTable: [
      { itemId: "demon_core",    weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "fire_essence",  weight: 35, minQty: 1, maxQty: 3 },
      { itemId: "rare_weapon",   weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "rare_chest",    weight: 15, minQty: 1, maxQty: 1 },
    ],
    xpReward: 120, goldMin: 60, goldMax: 120,
    isElite: false, isBoss: false,
    description: "A demon wreathed in hellfire that feeds on the souls it burns.",
  },

  // ─── Tier B Boss ────────────────────────────────────────────────────
  inferno_archon: {
    id: "inferno_archon", name: "Inferno Archon", emoji: "🔥", tier: "B",
    type: "demon", element: "fire", weakness: ["water","void"],
    baseStats: { hp: 2200, atk: 70, def: 35, spd: 18, matk: 95, mdef: 40 },
    skills: ["m_meteor_fall","m_fire_storm","m_heat_aura","m_meltdown","m_summon_imps"],
    lootTable: [
      { itemId: "archon_heart",  weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "epic_weapon",   weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "legendary_chest",weight:10, minQty: 1, maxQty: 1 },
      { itemId: "epic_chest",    weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "fire_crystal",  weight: 25, minQty: 3, maxQty: 6 },
    ],
    xpReward: 1500, goldMin: 700, goldMax: 1400,
    isElite: false, isBoss: true,
    description: "A mighty demon lord who commands the fires of the Inferno Spire.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // TIER A — Abyssal Rift (Lv 35–49)
  // ══════════════════════════════════════════════════════════════════════

  void_stalker: {
    id: "void_stalker", name: "Void Stalker", emoji: "🌑", tier: "A",
    type: "void", element: "void", weakness: ["light"],
    baseStats: { hp: 350, atk: 80, def: 30, spd: 28, matk: 60, mdef: 35 },
    skills: ["m_void_slash","m_phase_shift","m_devour","m_shadow_clone"],
    lootTable: [
      { itemId: "void_shard",    weight: 35, minQty: 1, maxQty: 2 },
      { itemId: "shadow_cloth",  weight: 25, minQty: 1, maxQty: 2 },
      { itemId: "epic_accessory",weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "legendary_chest",weight:15, minQty: 1, maxQty: 1 },
    ],
    xpReward: 300, goldMin: 150, goldMax: 300,
    isElite: false, isBoss: false,
    description: "A predator from the void dimension that hunts by scent of mana.",
  },

  // ─── Tier A Boss ────────────────────────────────────────────────────
  abyssal_leviathan: {
    id: "abyssal_leviathan", name: "Abyssal Leviathan", emoji: "🐉", tier: "A",
    type: "dragon", element: "void", weakness: ["light","lightning"],
    baseStats: { hp: 6000, atk: 120, def: 60, spd: 20, matk: 130, mdef: 70 },
    skills: ["m_void_breath","m_tail_sweep","m_rift_tear","m_ancient_curse","m_phase2_wings"],
    lootTable: [
      { itemId: "leviathan_scale",weight: 20, minQty: 1, maxQty: 2 },
      { itemId: "legendary_weapon",weight:15, minQty: 1, maxQty: 1 },
      { itemId: "legendary_chest", weight:20, minQty: 1, maxQty: 1 },
      { itemId: "void_core",       weight:15, minQty: 1, maxQty: 1 },
      { itemId: "mythic_chest",    weight: 5, minQty: 1, maxQty: 1 },
      { itemId: "dark_crystal",    weight:25, minQty: 5, maxQty: 10 },
    ],
    xpReward: 5000, goldMin: 2000, goldMax: 4000,
    isElite: false, isBoss: true,
    description: "An ancient dragon-like entity that has consumed entire dimensions.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // TIER S — Titan's Vault (Lv 50–74)
  // ══════════════════════════════════════════════════════════════════════

  titan_guardian: {
    id: "titan_guardian", name: "Titan Guardian", emoji: "⚙️", tier: "S",
    type: "construct", element: "lightning", weakness: ["earth","void"],
    baseStats: { hp: 600, atk: 110, def: 80, spd: 12, matk: 80, mdef: 75 },
    skills: ["m_thunder_slam","m_arc_cannon","m_barrier","m_overclock"],
    lootTable: [
      { itemId: "titan_core",       weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "mythril_plate",    weight: 20, minQty: 1, maxQty: 1 },
      { itemId: "legendary_chest",  weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "mythic_chest",     weight: 10, minQty: 1, maxQty: 1 },
      { itemId: "lightning_crystal",weight: 15, minQty: 2, maxQty: 4 },
    ],
    xpReward: 600, goldMin: 300, goldMax: 600,
    isElite: false, isBoss: false,
    description: "A massive construct built to guard the Titan's Vault for eternity.",
  },

  // ─── Tier S Boss ────────────────────────────────────────────────────
  titan_overlord: {
    id: "titan_overlord", name: "Titan Overlord", emoji: "🏛️", tier: "S",
    type: "construct", element: "lightning", weakness: ["void"],
    baseStats: { hp: 15000, atk: 180, def: 110, spd: 15, matk: 160, mdef: 120 },
    skills: ["m_omega_cannon","m_system_overload","m_repair_protocol","m_titan_stomp","m_emp_blast"],
    lootTable: [
      { itemId: "mythic_core",      weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "mythic_weapon",    weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "mythic_chest",     weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "unique_chest",     weight:  5, minQty: 1, maxQty: 1 },
      { itemId: "legendary_chest",  weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "titan_blueprint",  weight: 15, minQty: 1, maxQty: 1 },
    ],
    xpReward: 15000, goldMin: 6000, goldMax: 12000,
    isElite: false, isBoss: true,
    description: "The original master construct. It has been waiting for challengers for millennia.",
  },

  // ══════════════════════════════════════════════════════════════════════
  // TIER EX — Void Nexus (Lv 75+)
  // ══════════════════════════════════════════════════════════════════════

  void_herald: {
    id: "void_herald", name: "Void Herald", emoji: "🌌", tier: "EX",
    type: "void", element: "void", weakness: ["light"],
    baseStats: { hp: 1200, atk: 200, def: 100, spd: 35, matk: 220, mdef: 110 },
    skills: ["m_void_pulse","m_rift_walk","m_mind_shatter","m_consume","m_void_shield"],
    lootTable: [
      { itemId: "void_essence",    weight: 30, minQty: 1, maxQty: 2 },
      { itemId: "mythic_chest",    weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "unique_chest",    weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "void_crystal",    weight: 30, minQty: 3, maxQty: 6 },
    ],
    xpReward: 1200, goldMin: 600, goldMax: 1200,
    isElite: false, isBoss: false,
    description: "A servant of the Void God, sent to consume all light and life.",
  },

  // ─── Tier EX Boss ───────────────────────────────────────────────────
  void_god_fragment: {
    id: "void_god_fragment", name: "Void God — Shattered Form", emoji: "🕳️", tier: "EX",
    type: "god", element: "void", weakness: [],
    baseStats: { hp: 50000, atk: 350, def: 180, spd: 25, matk: 400, mdef: 200 },
    skills: [
      "m_annihilation","m_reality_tear","m_void_singularity",
      "m_absorb_souls","m_time_stop","m_phase3_awakening",
    ],
    lootTable: [
      { itemId: "void_god_shard",   weight: 10, minQty: 1, maxQty: 1 },
      { itemId: "unique_weapon",    weight: 15, minQty: 1, maxQty: 1 },
      { itemId: "unique_chest",     weight: 30, minQty: 1, maxQty: 1 },
      { itemId: "mythic_chest",     weight: 25, minQty: 1, maxQty: 1 },
      { itemId: "cosmos_gem",       weight: 10, minQty: 1, maxQty: 1 },
      { itemId: "title_void_slayer",weight: 10, minQty: 1, maxQty: 1 },
    ],
    xpReward: 50000, goldMin: 20000, goldMax: 40000,
    isElite: false, isBoss: true,
    description: "A fragment of the Void God itself. Even in its broken state, it defies comprehension.",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get all monsters that can appear in a given tier (includes lower tiers) */
function getMonstersForTier(tier) {
  const ORDER = ["D","C","B","A","S","EX"];
  const idx   = ORDER.indexOf(tier);
  return Object.values(MONSTERS).filter(m => ORDER.indexOf(m.tier) <= idx);
}

/** Get regular (non-elite, non-boss) monsters for a tier */
function getNormalMonsters(tier) {
  return getMonstersForTier(tier).filter(m => !m.isElite && !m.isBoss);
}

/** Get elite monsters for a tier */
function getEliteMonsters(tier) {
  return getMonstersForTier(tier).filter(m => m.isElite);
}

/** Get the boss monster for a specific tier */
function getBossForTier(tier) {
  return Object.values(MONSTERS).find(m => m.tier === tier && m.isBoss) ?? null;
}

/** Scale a monster's stats for a specific floor */
function scaleMonster(monster, floor, tier) {
  const TIER_MULT = { D: 1.0, C: 1.8, B: 3.0, A: 5.0, S: 8.0, EX: 14.0 };
  const floorMult  = 1 + (floor - 1) * 0.08;
  const tierMult   = TIER_MULT[tier] ?? 1.0;
  const total      = floorMult * tierMult;

  return {
    ...monster,
    hp:   Math.floor(monster.baseStats.hp   * total),
    maxHp:Math.floor(monster.baseStats.hp   * total),
    mp:   100,
    atk:  Math.floor(monster.baseStats.atk  * total),
    def:  Math.floor(monster.baseStats.def  * total),
    spd:  Math.floor(monster.baseStats.spd  * (1 + (floor - 1) * 0.03)),
    matk: Math.floor(monster.baseStats.matk * total),
    mdef: Math.floor(monster.baseStats.mdef * total),
    statusEffects: [],
    buffs: [],
  };
}

module.exports = { MONSTERS, getMonstersForTier, getNormalMonsters, getEliteMonsters, getBossForTier, scaleMonster };
