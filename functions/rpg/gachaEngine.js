// functions/rpg/gachaEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// GachaEngine — all pull logic lives here.
//
//   GachaEngine.pull(player, banner, count, character)  → PullResult[]
//   GachaEngine.canPull(player, banner, count, character) → { ok, reason }
//   GachaEngine.getRates(banner, pityState) → rateTable
// ─────────────────────────────────────────────────────────────────────────────

const { GACHA_ITEMS, RARITY_CONFIG, getItemsForBannerPool } = require("../../data/gacha");

// ─── Global default pull rates ────────────────────────────────────────────────
const BASE_RATES = {
  standard: { common:0.290, uncommon:0.400, rare:0.253, epic:0.051, legendary:0.006, mythic:0.000, unique:0.000 },
  character:{ common:0.290, uncommon:0.400, rare:0.253, epic:0.051, legendary:0.006, mythic:0.000, unique:0.000 },
  weapon:   { common:0.290, uncommon:0.380, rare:0.253, epic:0.060, legendary:0.015, mythic:0.000, unique:0.000 },
  beginner: { common:0.000, uncommon:0.000, rare:0.600, epic:0.300, legendary:0.090, mythic:0.000, unique:0.010 },
  faction:  { common:0.200, uncommon:0.350, rare:0.280, epic:0.100, legendary:0.060, mythic:0.010, unique:0.000 },
  collab:   { common:0.200, uncommon:0.360, rare:0.260, epic:0.100, legendary:0.060, mythic:0.018, unique:0.002 },
};

// ─── Pull result structure ────────────────────────────────────────────────────
// { itemId, name, rarity, emoji, type, wasPity, wasRateUp, isFeatured, isDupe }

class GachaEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // CAN PULL — validation before spending gems
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {GachaPlayer} gachaPlayer
   * @param {GachaBanner} banner
   * @param {number}      count       — 1 or 10
   * @param {Character}   character   — for gem balance
   * @returns {{ ok: boolean, reason: string|null }}
   */
  static canPull(gachaPlayer, banner, count, character) {
    const cost = count === 10 ? banner.tenPullCost : banner.gemCost * count;

    // Gem check
    if (character.currency.gems < cost) {
      return {
        ok: false,
        reason: `❌ Not enough gems! Need **${cost}** 💎, you have **${character.currency.gems}** 💎.`,
      };
    }

    // Beginner banner limit
    if (banner.type === "beginner") {
      const pityState = gachaPlayer.getPityState(banner.bannerId);
      const remaining = 20 - (pityState.pullCount ?? 0);
      if (remaining <= 0) {
        return { ok: false, reason: "❌ You've already used all 20 Beginner Banner pulls." };
      }
      if (count === 10 && remaining < 10) {
        return { ok: false, reason: `❌ Only **${remaining}** Beginner pulls remain. Use single pull.` };
      }
    }

    // Banner active check
    if (!banner.active) {
      return { ok: false, reason: "❌ This banner is no longer active." };
    }

    // End date check
    if (banner.endDate && new Date() > new Date(banner.endDate)) {
      return { ok: false, reason: "❌ This banner has ended." };
    }

    return { ok: true, reason: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET RATES — apply soft pity scaling
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute effective legendary rate after soft pity scaling.
   * @param {GachaBanner} banner
   * @param {object}      pityState
   * @returns {{ legendary: number, epic: number, ... }}
   */
  static getRates(banner, pityState) {
    const base = { ...(BASE_RATES[banner.type] ?? BASE_RATES.standard) };
    const currentPity = pityState.pityCounter ?? 0;

    // Soft pity for legendary
    if (currentPity >= banner.softPityStart) {
      const extraPulls = currentPity - banner.softPityStart + 1;
      const boost      = extraPulls * (banner.softPityInc ?? 0.06);
      base.legendary   = Math.min(1.0, base.legendary + boost);
    }

    // Soft pity for epic (start at pull 50)
    const epicPity = pityState.epicPityCounter ?? 0;
    if (epicPity >= 50) {
      const extraPulls = epicPity - 50 + 1;
      base.epic = Math.min(1.0, base.epic + extraPulls * 0.02);
    }

    // Normalise so rates sum to 1
    const total = Object.values(base).reduce((s, v) => s + v, 0);
    for (const key of Object.keys(base)) base[key] = base[key] / total;

    return base;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SINGLE PULL
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Execute one pull on a banner.
   * Mutates pityState in-place — caller must save gachaPlayer afterwards.
   *
   * @param {GachaBanner} banner
   * @param {object}      pityState   — from gachaPlayer.getPityState()
   * @param {string[]}    itemPool    — itemIds available on this banner
   * @returns {object}   pull result
   */
  static _singlePull(banner, pityState, itemPool) {
    pityState.pullCount       = (pityState.pullCount ?? 0) + 1;
    pityState.pityCounter     = (pityState.pityCounter ?? 0) + 1;
    pityState.epicPityCounter = (pityState.epicPityCounter ?? 0) + 1;

    let rarity   = null;
    let wasPity  = false;

    // ── Hard pity ────────────────────────────────────────────────────────────
    if (pityState.pityCounter >= banner.hardPity) {
      rarity  = "legendary";
      wasPity = true;
    }
    // Epic hard pity at 70
    else if (pityState.epicPityCounter >= 70) {
      rarity  = "epic";
      wasPity = true;
    }
    else {
      // ── Roll rarity ──────────────────────────────────────────────────────
      const rates = GachaEngine.getRates(banner, pityState);
      rarity      = GachaEngine._rollRarity(rates);
    }

    // ── Reset pity counters ───────────────────────────────────────────────────
    if (rarity === "legendary" || rarity === "mythic" || rarity === "unique") {
      pityState.pityCounter = 0;
    }
    if (rarity === "epic") {
      pityState.epicPityCounter = 0;
    }

    // ── Select item ───────────────────────────────────────────────────────────
    const { item, wasRateUp, isFeatured } = GachaEngine._selectItem(
      banner, pityState, itemPool, rarity
    );

    if (!item) {
      // Fallback — should never happen with a well-configured pool
      return GachaEngine._fallbackItem(rarity);
    }

    return {
      itemId:     item.id,
      name:       item.name,
      rarity,
      emoji:      item.emoji ?? RARITY_CONFIG[rarity]?.emoji ?? "✨",
      type:       item.type,
      passive:    item.passive ?? null,
      statBonus:  item.statBonus ?? null,
      wasPity,
      wasRateUp,
      isFeatured,
      isDupe:     false, // set by recordPull
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MULTI PULL
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Execute N pulls. Handles gem deduction and saving.
   *
   * @param {GachaPlayer} gachaPlayer
   * @param {GachaBanner} banner
   * @param {number}      count         — 1 or 10
   * @param {Character}   character     — for gem deduction
   * @returns {{ results: object[], totalCost: number }}
   */
  static pull(gachaPlayer, banner, count, character) {
    const totalCost = count === 10 ? banner.tenPullCost : banner.gemCost * count;
    const pityState = gachaPlayer.getPityState(banner.bannerId);
    const itemPool  = banner.itemPool ?? [];

    // Deduct gems
    character.currency.gems -= totalCost;
    gachaPlayer.totalSpentGems += totalCost;

    const results = [];

    for (let i = 0; i < count; i++) {
      // Beginner banner: guarantee a rare+ on pull 10
      if (banner.type === "beginner" && ((pityState.pullCount % 10) === 9)) {
        pityState.pityCounter = banner.softPityStart; // force soft pity
      }

      const result = GachaEngine._singlePull(banner, pityState, itemPool);

      // Mark dupe
      const alreadyOwned = gachaPlayer.ownedItems.some(o => o.itemId === result.itemId);
      result.isDupe = alreadyOwned;

      // Record
      gachaPlayer.recordPull(banner.bannerId, result);
      results.push(result);
    }

    // Update banner total
    banner.totalPulls = (banner.totalPulls ?? 0) + count;

    return { results, totalCost };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM SELECTION
  // ───────────────────────────────────────────────────────────────────────────

  static _selectItem(banner, pityState, itemPool, rarity) {
    const featured = banner.featuredItems?.filter(f => f.rarity === rarity) ?? [];
    let wasRateUp  = false;
    let isFeatured = false;

    // 50/50 rate-up for character/collab banners
    if (featured.length > 0 && (banner.type === "character" || banner.type === "collab" || banner.type === "weapon")) {
      const doRateUp = pityState.guaranteedRateUp || Math.random() < 0.50;

      if (doRateUp) {
        const featuredItem = featured[Math.floor(Math.random() * featured.length)];
        const item = GACHA_ITEMS[featuredItem.itemId];
        if (item) {
          pityState.guaranteedRateUp = false;
          return { item, wasRateUp: true, isFeatured: true };
        }
      } else {
        // Lost the 50/50 — guarantee next legendary is rate-up
        pityState.guaranteedRateUp = true;
      }
    }

    // Pull from pool filtered by rarity
    const poolItems = itemPool
      .map(id => GACHA_ITEMS[id])
      .filter(item => item && item.rarity === rarity);

    if (!poolItems.length) return { item: null, wasRateUp: false, isFeatured: false };

    const item = poolItems[Math.floor(Math.random() * poolItems.length)];
    return { item, wasRateUp: false, isFeatured: false };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RARITY ROLLER
  // ───────────────────────────────────────────────────────────────────────────

  static _rollRarity(rates) {
    const roll = Math.random();
    let cumulative = 0;

    // Check highest rarities first for safety
    const order = ["unique","mythic","legendary","epic","rare","uncommon","common"];
    for (const rarity of order) {
      cumulative += rates[rarity] ?? 0;
      if (roll < cumulative) return rarity;
    }

    return "common";
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FALLBACK
  // ───────────────────────────────────────────────────────────────────────────

  static _fallbackItem(rarity) {
    const FALLBACKS = {
      common:    { itemId: "material_stardust_bag",  name: "Stardust Bag",    emoji: "⭐", type: "material" },
      uncommon:  { itemId: "material_gold_pouch",    name: "Gold Pouch",      emoji: "🪙", type: "material" },
      rare:      { itemId: "material_summon_crystal",name: "Summon Crystal",  emoji: "💎", type: "material" },
      epic:      { itemId: "hero_iron_sentinel",     name: "Iron Sentinel",   emoji: "🛡️", type: "hero"     },
      legendary: { itemId: "hero_aiden_blademaster", name: "Aiden the Blademaster","emoji":"⚔️", type:"hero"},
      mythic:    { itemId: "hero_void_empress",      name: "The Void Empress",emoji: "🌌", type: "hero"     },
      unique:    { itemId: "hero_void_empress",      name: "The Void Empress",emoji: "🌌", type: "hero"     },
    };
    return { ...(FALLBACKS[rarity] ?? FALLBACKS.common), rarity, wasPity: false, wasRateUp: false, isFeatured: false, isDupe: false };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STARDUST SHOP PURCHASE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {GachaPlayer} gachaPlayer
   * @param {string}      shopItemId
   * @param {Character}   character
   * @returns {{ ok: boolean, reason: string|null, reward: object|null }}
   */
  static purchaseStardust(gachaPlayer, shopItemId, character) {
    const { STARDUST_SHOP } = require("../../data/gacha");
    const shopItem = STARDUST_SHOP.find(s => s.id === shopItemId);
    if (!shopItem) return { ok: false, reason: "❌ Item not found.", reward: null };

    if (gachaPlayer.stardust < shopItem.cost) {
      return { ok: false, reason: `❌ Need **${shopItem.cost}** ⭐ stardust (you have ${gachaPlayer.stardust}).`, reward: null };
    }

    gachaPlayer.stardust -= shopItem.cost;

    // Apply reward
    let reward = { name: shopItem.name, emoji: "✅" };

    switch (shopItemId) {
      case "shop_100_gems":
        character.currency.gems += 100;
        reward.detail = "+100 💎 gems";
        break;
      case "shop_gold_10k":
        character.currency.gold += 10000;
        reward.detail = "+10,000 🪙 gold";
        break;
      case "shop_dungeon_seal": {
        const slot = character.inventory.find(i => i.itemId === "dungeon_seal");
        if (slot) slot.quantity++;
        else character.inventory.push({ itemId: "dungeon_seal", quantity: 1 });
        reward.detail = "+1 🔑 Dungeon Seal";
        break;
      }
      default:
        // Hero/weapon selectors — handled by a follow-up select menu
        reward.detail = shopItem.description;
        reward.needsSelection = true;
        break;
    }

    return { ok: true, reason: null, reward };
  }
}

module.exports = GachaEngine;
