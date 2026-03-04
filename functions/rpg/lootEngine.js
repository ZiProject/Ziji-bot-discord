// functions/rpg/lootEngine.js
// Handles all item drop logic for dungeons, bosses, and chests.

const SeededRNG = require("./seededRng");

// ─── Rarity Drop Chances by Dungeon Tier ────────────────────────────────────
const RARITY_WEIGHTS = {
  D:  { common: 55, uncommon: 25, rare: 12, epic: 6,  legendary: 1.5, mythic: 0.4, unique: 0.1 },
  C:  { common: 30, uncommon: 35, rare: 22, epic: 10, legendary: 2.5, mythic: 0.4, unique: 0.1 },
  B:  { common: 10, uncommon: 20, rare: 38, epic: 22, legendary: 7,   mythic: 2.5, unique: 0.5 },
  A:  { common: 0,  uncommon: 10, rare: 25, epic: 40, legendary: 18,  mythic: 5.5, unique: 1.5 },
  S:  { common: 0,  uncommon: 0,  rare: 10, epic: 30, legendary: 38,  mythic: 18,  unique: 4   },
  EX: { common: 0,  uncommon: 0,  rare: 0,  epic: 15, legendary: 35,  mythic: 35,  unique: 15  },
};

// ─── Item Pools by Rarity ────────────────────────────────────────────────────
// In production these would be loaded from data/items/*.json
// Here we have representative pools for each rarity tier.

const ITEM_POOLS = {
  common: [
    "iron_sword","iron_shield","cloth_armor","leather_boots",
    "health_potion","mana_potion","iron_ore","wood_plank",
    "rat_fang","goblin_ear","herb_red","herb_green",
  ],
  uncommon: [
    "steel_sword","chain_mail","wooden_staff","hunters_bow",
    "twin_daggers","holy_mace","battle_axe","summoner_tome",
    "uncommon_chest","fire_shard","dark_essence","bone_shard",
    "antidote","revive_feather",
  ],
  rare: [
    "mithril_sword","mithril_axe","arcane_staff","elven_bow",
    "shadow_dagger","divine_mace","berserker_axe","beast_tome",
    "rare_chest","ruby_gem_t1","sapphire_gem_t1","topaz_gem_t1",
    "elixir_hp","elixir_mp","rare_armor","fire_crystal",
  ],
  epic: [
    "void_reaper","inferno_staff","abyssal_bow","obsidian_dagger",
    "archon_blade","celestial_mace","chaos_axe","phantom_tome",
    "epic_chest","ruby_gem_t3","diamond_gem_t1","void_shard_gem",
    "epic_armor","greater_elixir","shadow_cloth","demon_core",
  ],
  legendary: [
    "dragons_wrath","eternal_flame","rift_bow","twilight_fang",
    "gods_hammer","holy_avenger","ragnarok_axe","grimoire_of_souls",
    "legendary_chest","ruby_gem_t5","void_crystal","archon_heart",
    "legendary_armor","leviathan_scale","phoenix_feather",
  ],
  mythic: [
    "world_ender","singularity_staff","cosmic_bow","death_whisper",
    "titan_crusher","divine_smite","chaos_incarnate","ancient_tome",
    "mythic_chest","cosmos_gem","titan_core","mythic_armor",
    "void_essence","dark_crystal_mythic",
  ],
  unique: [
    "abyss_crown","void_god_shard","world_breaker_blade",
    "primordial_codex","cosmos_gem","title_void_slayer",
    "unique_chest","origin_crystal",
  ],
};

class LootEngine {

  /**
   * Roll loot for a floor encounter.
   * Higher floors and guaranteed=true give bonus rarity.
   *
   * @param {string}     tier       — dungeon tier "D"–"EX"
   * @param {number}     floor      — current floor number
   * @param {SeededRNG}  rng        — seeded RNG instance
   * @param {boolean}    guaranteed — force a drop (no miss chance)
   * @returns {{ itemId: string, rarity: string } | null}
   */
  static rollFloorLoot(tier, floor, rng, guaranteed = false) {
    // Miss chance: 20% base, reduced by floor progress
    const missChance = Math.max(0, 0.20 - floor * 0.01);
    if (!guaranteed && rng.next() < missChance) return null;

    const rarityWeights = { ...RARITY_WEIGHTS[tier] };

    // Floor bonus: higher floors push rarity up slightly
    const floorBonus = Math.floor(floor / 5) * 2;
    rarityWeights.epic      = (rarityWeights.epic      ?? 0) + floorBonus;
    rarityWeights.legendary = (rarityWeights.legendary ?? 0) + Math.floor(floorBonus / 2);

    const rarity = LootEngine._rollRarity(rarityWeights, rng);
    const pool   = ITEM_POOLS[rarity] ?? ITEM_POOLS.common;
    const itemId = rng.pick(pool);

    return { itemId, rarity };
  }

  /**
   * Roll loot from a specific monster's lootTable.
   * @param {object[]} lootTable  — [{ itemId, weight, minQty, maxQty }]
   * @param {SeededRNG} rng
   * @returns {{ itemId: string, quantity: number }[]}
   */
  static rollMonsterLoot(lootTable, rng) {
    if (!lootTable?.length) return [];

    const drops = [];
    // Each entry has its own weight — roll once for the "primary" drop
    const totalWeight = lootTable.reduce((s, e) => s + e.weight, 0);
    let roll = rng.next() * totalWeight;

    for (const entry of lootTable) {
      roll -= entry.weight;
      if (roll <= 0) {
        drops.push({
          itemId:   entry.itemId,
          quantity: rng.nextInt(entry.minQty ?? 1, entry.maxQty ?? 1),
        });
        break;
      }
    }

    // Bonus drop: 15% chance for a second item
    if (rng.next() < 0.15 && lootTable.length > 1) {
      const second = rng.pick(lootTable);
      drops.push({ itemId: second.itemId, quantity: 1 });
    }

    return drops;
  }

  /**
   * Roll a chest's loot (used for treasure rooms, chests, etc.).
   * @param {string} chestType — "common_chest"|"rare_chest"|"epic_chest"|"legendary_chest"|"mythic_chest"|"unique_chest"
   * @param {SeededRNG} rng
   * @returns {{ itemId: string, rarity: string }[]}
   */
  static rollChest(chestType, rng) {
    const CHEST_TABLES = {
      common_chest:    { rolls: 2, rarityOverride: "common"    },
      uncommon_chest:  { rolls: 2, rarityOverride: "uncommon"  },
      rare_chest:      { rolls: 2, rarityOverride: "rare"      },
      epic_chest:      { rolls: 3, rarityOverride: "epic"      },
      legendary_chest: { rolls: 3, rarityOverride: "legendary" },
      mythic_chest:    { rolls: 4, rarityOverride: "mythic"    },
      unique_chest:    { rolls: 4, rarityOverride: "unique"    },
    };

    const config = CHEST_TABLES[chestType];
    if (!config) return [];

    const results = [];
    for (let i = 0; i < config.rolls; i++) {
      const pool   = ITEM_POOLS[config.rarityOverride] ?? ITEM_POOLS.common;
      const itemId = rng.pick(pool);
      results.push({ itemId, rarity: config.rarityOverride });
    }
    return results;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  static _rollRarity(weights, rng) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total   = entries.reduce((s, [, w]) => s + w, 0);
    let roll      = rng.next() * total;

    for (const [rarity, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return "common";
  }
}

module.exports = LootEngine;
