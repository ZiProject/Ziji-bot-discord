// data/gacha/index.js
// ─────────────────────────────────────────────────────────────────────────────
// All summonable items (heroes, weapons, cosmetics) and default banner configs.
// In production, banners are stored in MongoDB (GachaBanner model).
// This file seeds the DB on first boot via extensions/rpgGachaInit.js
// and is used as fallback reference for item metadata.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Rarity Config ───────────────────────────────────────────────────────────
const RARITY_CONFIG = {
  common:    { color: 0x95A5A6, emoji: "⬜", stardustValue: 1,   label: "Common"    },
  uncommon:  { color: 0x27AE60, emoji: "🟩", stardustValue: 3,   label: "Uncommon"  },
  rare:      { color: 0x2980B9, emoji: "🟦", stardustValue: 10,  label: "Rare"      },
  epic:      { color: 0x8E44AD, emoji: "🟪", stardustValue: 25,  label: "Epic"      },
  legendary: { color: 0xF39C12, emoji: "🟨", stardustValue: 50,  label: "Legendary" },
  mythic:    { color: 0xE67E22, emoji: "🔶", stardustValue: 100, label: "Mythic"    },
  unique:    { color: 0xE74C3C, emoji: "🔴", stardustValue: 200, label: "Unique"    },
};

// ─── Summonable Items ────────────────────────────────────────────────────────
// type: "hero" | "weapon" | "cosmetic" | "material"
// heroClass: which class this hero is (for hero items)
// passive: in-battle passive effect when equipped as a hero

const GACHA_ITEMS = {

  // ══════════════════════════════════════════════════════════════════════════
  // LEGENDARY HEROES
  // ══════════════════════════════════════════════════════════════════════════

  hero_aiden_blademaster: {
    id: "hero_aiden_blademaster", name: "Aiden the Blademaster",
    emoji: "⚔️", rarity: "legendary", type: "hero",
    heroClass: "warrior",
    description: "A warrior who has mastered every blade technique known. His strikes never miss.",
    passive: "Every 3rd attack triggers a free Titan's Fury at 50% power.",
    statBonus: { atk: 0.12, crit: 0.05 },
    banners: ["standard","character_aiden"],
  },

  hero_lyra_archmage: {
    id: "hero_lyra_archmage", name: "Lyra the Archmage",
    emoji: "🔮", rarity: "legendary", type: "hero",
    heroClass: "mage",
    description: "The most powerful mage alive. She shaped the laws of magic with her own hands.",
    passive: "Spell Echo chance +20%. Singularity CD -3 permanently.",
    statBonus: { matk: 0.15, crit: 0.08 },
    banners: ["standard","character_lyra"],
  },

  hero_shadow_rin: {
    id: "hero_shadow_rin", name: "Rin of the Shadow Veil",
    emoji: "🌑", rarity: "legendary", type: "hero",
    heroClass: "rogue",
    description: "An assassin who has killed 1000 targets. Nobody has ever seen her face.",
    passive: "Entering Stealth also applies Blind to all enemies. Death Mark CD -2.",
    statBonus: { atk: 0.10, crit: 0.10, critDmg: 0.20 },
    banners: ["standard","character_rin"],
  },

  hero_sol_archon: {
    id: "hero_sol_archon", name: "Sol the Divine Archon",
    emoji: "☀️", rarity: "legendary", type: "hero",
    heroClass: "cleric",
    description: "A cleric chosen by the gods. His touch heals the incurable.",
    passive: "All heals are AoE at 60% value. Holy Aura lasts 2 extra turns.",
    statBonus: { matk: 0.12, def: 0.08 },
    banners: ["standard","character_sol"],
  },

  hero_kira_sentinel: {
    id: "hero_kira_sentinel", name: "Kira the Silent Sentinel",
    emoji: "🏹", rarity: "legendary", type: "hero",
    heroClass: "ranger",
    description: "A ranger who can hit a coin from 3 miles away. Blindfolded.",
    passive: "Hunter's Mark applies automatically on first attack each combat. Volley +3 arrows.",
    statBonus: { atk: 0.11, crit: 0.07 },
    banners: ["standard","character_kira"],
  },

  hero_ragnar_chaos: {
    id: "hero_ragnar_chaos", name: "Ragnar the Chaos Knight",
    emoji: "💥", rarity: "legendary", type: "hero",
    heroClass: "berserker",
    description: "A berserker who thrives in pure destruction. The more pain, the more power.",
    passive: "Blood Frenzy no longer has a DEF penalty. Savage Strike costs 0 HP.",
    statBonus: { atk: 0.20, hp: 0.05 },
    banners: ["standard","character_ragnar"],
  },

  hero_void_empress: {
    id: "hero_void_empress", name: "The Void Empress",
    emoji: "🌌", rarity: "mythic", type: "hero",
    heroClass: "elementalist",
    description: "A being from beyond reality. She exists in all elements simultaneously.",
    passive: "Prism Beam hits twice. Elemental attunement switches automatically to exploit weakness.",
    statBonus: { matk: 0.25, crit: 0.10, critDmg: 0.30 },
    banners: ["collab_void"],
  },

  hero_death_knight: {
    id: "hero_death_knight", name: "Malachar the Death Knight",
    emoji: "💀", rarity: "mythic", type: "hero",
    heroClass: "necromancer",
    description: "The first mortal to willingly become undead. He commands legions of the dead.",
    passive: "Death Nova summons 3 extra skeletons. All undead take 0 damage from fire.",
    statBonus: { matk: 0.18, def: 0.12 },
    banners: ["standard"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEGENDARY WEAPONS
  // ══════════════════════════════════════════════════════════════════════════

  weapon_excalibur: {
    id: "weapon_excalibur", name: "Excalibur",
    emoji: "⚔️", rarity: "legendary", type: "weapon",
    slot: "weapon", allowedClasses: ["warrior","paladin"],
    description: "The legendary blade of kings. Only the worthy may wield it.",
    passive: "Holy damage ignores 30% resistance. Shield Slam CD -1.",
    statBonus: { atk: 85, def: 20 },
    banners: ["standard","weapon_banner"],
  },

  weapon_void_staff: {
    id: "weapon_void_staff", name: "Staff of the Void",
    emoji: "🔮", rarity: "legendary", type: "weapon",
    slot: "weapon", allowedClasses: ["mage","elementalist","necromancer"],
    description: "A staff forged from crystallized void energy. It whispers dark secrets.",
    passive: "Void spells deal +25% damage. Singularity gains 1 extra target.",
    statBonus: { matk: 95, mdef: 15 },
    banners: ["standard","weapon_banner"],
  },

  weapon_shadow_fang: {
    id: "weapon_shadow_fang", name: "Shadow Fang",
    emoji: "🗡️", rarity: "legendary", type: "weapon",
    slot: "weapon", allowedClasses: ["rogue"],
    description: "Twin daggers that move faster than the eye can follow.",
    passive: "Backstab can be used without Stealth. Crit rate +15%.",
    statBonus: { atk: 70, spd: 12, crit: 0.08 },
    banners: ["standard","weapon_banner"],
  },

  weapon_dragons_wrath: {
    id: "weapon_dragons_wrath", name: "Dragon's Wrath",
    emoji: "🐉", rarity: "legendary", type: "weapon",
    slot: "weapon", allowedClasses: ["berserker","warrior"],
    description: "An axe forged from dragonbone and tempered in dragonfire.",
    passive: "All physical attacks deal bonus fire damage equal to 20% ATK. Lifesteal +10%.",
    statBonus: { atk: 100, crit: 0.06 },
    banners: ["standard","weapon_banner"],
  },

  weapon_holy_avenger: {
    id: "weapon_holy_avenger", name: "Holy Avenger",
    emoji: "✝️", rarity: "legendary", type: "weapon",
    slot: "weapon", allowedClasses: ["cleric","paladin"],
    description: "A weapon blessed by every holy order in existence.",
    passive: "Heal spells deal 30% of heal amount as light damage to nearest enemy. Smite AoE.",
    statBonus: { matk: 75, def: 25 },
    banners: ["standard","weapon_banner"],
  },

  weapon_world_ender: {
    id: "weapon_world_ender", name: "World Ender",
    emoji: "🌑", rarity: "mythic", type: "weapon",
    slot: "weapon", allowedClasses: ["warrior","berserker","mage","elementalist"],
    description: "A weapon said to have ended the last age of the world.",
    passive: "Every 5 kills: gain Berserk + Spell Echo simultaneously for 3 turns.",
    statBonus: { atk: 120, matk: 120, crit: 0.12 },
    banners: ["collab_void"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EPIC ITEMS
  // ══════════════════════════════════════════════════════════════════════════

  hero_iron_sentinel: {
    id: "hero_iron_sentinel", name: "Iron Sentinel",
    emoji: "🛡️", rarity: "epic", type: "hero",
    heroClass: "warrior",
    description: "A veteran warrior who has survived a hundred battles.",
    passive: "Counter Strike activates on ALL damage types, not just physical.",
    statBonus: { def: 0.15, hp: 0.10 },
    banners: ["standard"],
  },

  hero_frost_mage: {
    id: "hero_frost_mage", name: "Celeste the Frost Mage",
    emoji: "❄️", rarity: "epic", type: "hero",
    heroClass: "mage",
    description: "A mage who specialises in ice magic and crowd control.",
    passive: "Frozen targets take +40% damage instead of +30%.",
    statBonus: { matk: 0.10, mdef: 0.08 },
    banners: ["standard"],
  },

  weapon_inferno_staff: {
    id: "weapon_inferno_staff", name: "Inferno Staff",
    emoji: "🔥", rarity: "epic", type: "weapon",
    slot: "weapon", allowedClasses: ["mage","elementalist"],
    description: "A staff that burns eternally.",
    passive: "Fireball Burn stacks +1. Fire damage +15%.",
    statBonus: { matk: 60, crit: 0.04 },
    banners: ["standard"],
  },

  weapon_abyssal_bow: {
    id: "weapon_abyssal_bow", name: "Abyssal Bow",
    emoji: "🏹", rarity: "epic", type: "weapon",
    slot: "weapon", allowedClasses: ["ranger"],
    description: "A bow crafted from the bones of an Abyssal Leviathan.",
    passive: "Volley gains +2 arrows. Arrow hits apply Hunter's Mark at 40% chance.",
    statBonus: { atk: 55, crit: 0.06 },
    banners: ["standard"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COSMETICS (no combat effect)
  // ══════════════════════════════════════════════════════════════════════════

  cosmetic_aura_golden: {
    id: "cosmetic_aura_golden", name: "Golden Aura",
    emoji: "✨", rarity: "epic", type: "cosmetic",
    description: "A golden aura that surrounds your character in combat.",
    banners: ["standard"],
  },

  cosmetic_title_void_walker: {
    id: "cosmetic_title_void_walker", name: "Title: Void Walker",
    emoji: "🌌", rarity: "legendary", type: "cosmetic",
    description: "A title earned by those who have walked the void.",
    banners: ["collab_void"],
  },

  cosmetic_profile_frame_dragon: {
    id: "cosmetic_profile_frame_dragon", name: "Dragon Frame",
    emoji: "🐉", rarity: "rare", type: "cosmetic",
    description: "A dragon-themed profile frame.",
    banners: ["standard"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COMMON / UNCOMMON FILLERS
  // ══════════════════════════════════════════════════════════════════════════

  material_summon_crystal: {
    id: "material_summon_crystal", name: "Summon Crystal",
    emoji: "💎", rarity: "rare", type: "material",
    description: "A crystal that can be traded for 50 gems.",
    banners: ["standard"],
  },

  material_hero_xp: {
    id: "material_hero_xp", name: "Hero EXP Tome",
    emoji: "📚", rarity: "uncommon", type: "material",
    description: "Grants 500 XP to your character.",
    banners: ["standard"],
  },

  material_gold_pouch: {
    id: "material_gold_pouch", name: "Large Gold Pouch",
    emoji: "🪙", rarity: "uncommon", type: "material",
    description: "Contains 1000 gold.",
    banners: ["standard"],
  },

  material_stardust_bag: {
    id: "material_stardust_bag", name: "Stardust Bag",
    emoji: "⭐", rarity: "common", type: "material",
    description: "Contains 50 stardust.",
    banners: ["standard"],
  },
};

// ─── Default Banner Definitions (seeded to DB on boot) ───────────────────────
const DEFAULT_BANNERS = [
  {
    bannerId:    "standard",
    name:        "Eternal Summons",
    type:        "standard",
    emoji:       "🌟",
    description: "The standard banner. All heroes and weapons available. No rate-up.",
    color:       0x2980B9,
    gemCost:     300,
    tenPullCost: 2700,
    featuredItems: [],
    itemPool: Object.values(GACHA_ITEMS)
      .filter(i => i.banners.includes("standard"))
      .map(i => i.id),
    hardPity:      90,
    softPityStart: 75,
    softPityInc:   0.06,
    active: true,
  },
  {
    bannerId:    "character_aiden",
    name:        "⚔️ Blademaster's Return",
    type:        "character",
    emoji:       "⚔️",
    description: "Rate-up: Aiden the Blademaster (Legendary Warrior). 50/50 at pity.",
    color:       0xE74C3C,
    gemCost:     300,
    tenPullCost: 2700,
    featuredItems: [
      { itemId: "hero_aiden_blademaster", name: "Aiden the Blademaster", rarity: "legendary", emoji: "⚔️", isRateUp: true },
    ],
    itemPool: Object.values(GACHA_ITEMS)
      .filter(i => i.banners.includes("standard") || i.banners.includes("character_aiden"))
      .map(i => i.id),
    hardPity:      90,
    softPityStart: 75,
    softPityInc:   0.06,
    active: true,
  },
  {
    bannerId:    "weapon_banner",
    name:        "🗡️ Armory of Legends",
    type:        "weapon",
    emoji:       "🗡️",
    description: "Rate-up on legendary weapons. Guaranteed weapon at pity 80.",
    color:       0xF39C12,
    gemCost:     240,
    tenPullCost: 2160,
    featuredItems: [
      { itemId: "weapon_excalibur",   name: "Excalibur",          rarity: "legendary", emoji: "⚔️", isRateUp: true },
      { itemId: "weapon_void_staff",  name: "Staff of the Void",  rarity: "legendary", emoji: "🔮", isRateUp: true },
    ],
    itemPool: Object.values(GACHA_ITEMS)
      .filter(i => i.type === "weapon" || i.banners.includes("standard"))
      .map(i => i.id),
    hardPity:      80,
    softPityStart: 65,
    softPityInc:   0.07,
    active: true,
  },
  {
    bannerId:    "beginner",
    name:        "🌱 Beginner's Blessing",
    type:        "beginner",
    emoji:       "🌱",
    description: "Discounted pulls for new adventurers. Guaranteed Rare within 10 pulls. Limited to 20 pulls total.",
    color:       0x27AE60,
    gemCost:     150,
    tenPullCost: 1350,
    featuredItems: [],
    itemPool: Object.values(GACHA_ITEMS)
      .filter(i => ["rare","epic","legendary"].includes(i.rarity) && i.banners.includes("standard"))
      .map(i => i.id),
    hardPity:      10,
    softPityStart: 8,
    softPityInc:   0.10,
    active: true,
  },
  {
    bannerId:    "collab_void",
    name:        "🌌 Void Incursion — LIMITED",
    type:        "collab",
    emoji:       "🌌",
    description: "Limited collab banner. Exclusive mythic items: The Void Empress & World Ender. Never returns.",
    color:       0x1A1A2E,
    gemCost:     350,
    tenPullCost: 3150,
    featuredItems: [
      { itemId: "hero_void_empress", name: "The Void Empress", rarity: "mythic", emoji: "🌌", isRateUp: true },
      { itemId: "weapon_world_ender",name: "World Ender",      rarity: "mythic", emoji: "🌑", isRateUp: true },
    ],
    itemPool: Object.values(GACHA_ITEMS)
      .filter(i => i.banners.includes("collab_void") || i.banners.includes("standard"))
      .map(i => i.id),
    hardPity:      80,
    softPityStart: 65,
    softPityInc:   0.08,
    active: true,
  },
];

// ─── Stardust Shop ────────────────────────────────────────────────────────────
const STARDUST_SHOP = [
  { id: "shop_epic_selector",   name: "Epic Hero Selector",   cost: 3000,  description: "Choose any Epic hero from the standard pool." },
  { id: "shop_legend_fragment", name: "Legendary Fragment ×1",cost: 5000,  description: "Combine 5 to pick any Legendary hero." },
  { id: "shop_weapon_epic",     name: "Epic Weapon Selector", cost: 2500,  description: "Choose any Epic weapon." },
  { id: "shop_100_gems",        name: "100 Gems",             cost: 800,   description: "Convert stardust to gems." },
  { id: "shop_gold_10k",        name: "10,000 Gold",          cost: 500,   description: "Convert stardust to gold." },
  { id: "shop_dungeon_seal",    name: "Dungeon Seal",         cost: 1200,  description: "One-time use EX dungeon seal." },
  { id: "shop_cosmetic_frame",  name: "Starlight Frame",      cost: 4000,  description: "Exclusive stardust-only profile frame." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getItem(itemId) {
  return GACHA_ITEMS[itemId] ?? null;
}

function getItemsByRarity(rarity) {
  return Object.values(GACHA_ITEMS).filter(i => i.rarity === rarity);
}

function getItemsForBannerPool(itemPool) {
  return itemPool.map(id => GACHA_ITEMS[id]).filter(Boolean);
}

module.exports = {
  GACHA_ITEMS, DEFAULT_BANNERS, STARDUST_SHOP, RARITY_CONFIG,
  getItem, getItemsByRarity, getItemsForBannerPool,
};
