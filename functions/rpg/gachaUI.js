// functions/rpg/gachaUI.js
// ─────────────────────────────────────────────────────────────────────────────
// All embed & component builders for the gacha system.
// ─────────────────────────────────────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
        StringSelectMenuBuilder } = require("discord.js");
const { RARITY_CONFIG, STARDUST_SHOP, DEFAULT_BANNERS } = require("../../data/gacha");

// ─── Rarity display helpers ───────────────────────────────────────────────────
const RARITY_ORDER = ["unique","mythic","legendary","epic","rare","uncommon","common"];

function rarityBar(rarity) {
  const cfg = RARITY_CONFIG[rarity];
  return cfg ? `${cfg.emoji} **${cfg.label}**` : rarity;
}

function sortByRarity(results) {
  return [...results].sort((a, b) =>
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANNER LIST — /gacha banners
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaBanner[]} banners  — active banner docs
 * @param {GachaPlayer}  player
 * @param {Character}    character
 */
function buildBannerListEmbed(banners, player, character) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle("🎰 Gacha — Active Banners")
    .setDescription(
      `💎 Your Gems: **${character.currency.gems.toLocaleString()}**  ` +
      `⭐ Stardust: **${player.stardust.toLocaleString()}**\n` +
      `Total Pulls: **${player.totalPulls}**  ` +
      `Legendaries: **${player.totalLegendary}**`
    );

  for (const banner of banners) {
    const pityState = player.getPityState(banner.bannerId);
    const pity      = pityState.pityCounter ?? 0;
    const pityBar   = buildPityBar(pity, banner.hardPity);
    const limited   = banner.endDate
      ? `⏰ Ends <t:${Math.floor(new Date(banner.endDate).getTime() / 1000)}:R>`
      : "";
    const featured  = banner.featuredItems.length > 0
      ? banner.featuredItems.map(f => `${f.emoji} ${f.name}`).join(", ")
      : "No rate-up";

    embed.addFields({
      name: `${banner.emoji} ${banner.name}`,
      value: [
        `${banner.description}`,
        `💎 Single: **${banner.gemCost}** | 10x: **${banner.tenPullCost}**`,
        `⭐ Rate-up: ${featured}`,
        `🎯 Pity: ${pityBar} **${pity}/${banner.hardPity}**`,
        limited,
      ].filter(Boolean).join("\n"),
      inline: false,
    });
  }

  // Banner select menu
  const select = new StringSelectMenuBuilder()
    .setCustomId("S_GACHA_BANNER_SELECT")
    .setPlaceholder("Select a banner to pull...")
    .addOptions(banners.map(b => ({
      label:       b.name.replace(/[^\w\s\-]/g, "").trim().substring(0, 25) || b.bannerId,
      description: `💎 ${b.gemCost} single | ${b.tenPullCost} 10x`,
      value:       b.bannerId,
      emoji:       "🎰",
    })));

  const shopBtn = new ButtonBuilder()
    .setCustomId("B_GACHA_SHOP")
    .setLabel("⭐ Stardust Shop")
    .setStyle(ButtonStyle.Secondary);

  const histBtn = new ButtonBuilder()
    .setCustomId("B_GACHA_HISTORY")
    .setLabel("📜 Pull History")
    .setStyle(ButtonStyle.Secondary);

  return {
    embed,
    rows: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(shopBtn, histBtn),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANNER DETAIL — single banner view with pull buttons
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaBanner} banner
 * @param {GachaPlayer} player
 * @param {Character}   character
 */
function buildBannerDetailEmbed(banner, player, character) {
  const pityState    = player.getPityState(banner.bannerId);
  const pity         = pityState.pityCounter ?? 0;
  const epicPity     = pityState.epicPityCounter ?? 0;
  const canAfford1   = character.currency.gems >= banner.gemCost;
  const canAfford10  = character.currency.gems >= banner.tenPullCost;

  // Compute effective rates with soft pity
  const GachaEngine = require("./gachaEngine");
  const rates        = GachaEngine.getRates(banner, pityState);

  const embed = new EmbedBuilder()
    .setColor(banner.color ?? 0x9B59B6)
    .setTitle(`${banner.emoji} ${banner.name}`)
    .setDescription(banner.description);

  // Featured items
  if (banner.featuredItems.length > 0) {
    embed.addFields({
      name: "⭐ Rate-Up Items",
      value: banner.featuredItems.map(f =>
        `${f.emoji} **${f.name}** — ${rarityBar(f.rarity)} *(50/50 rate-up)*`
      ).join("\n"),
      inline: false,
    });
  }

  // Rates
  const rateLines = RARITY_ORDER
    .filter(r => (rates[r] ?? 0) > 0)
    .map(r => {
      const pct = (rates[r] * 100).toFixed(2);
      const cfg = RARITY_CONFIG[r];
      return `${cfg.emoji} ${cfg.label}: **${pct}%**`;
    });

  embed.addFields(
    {
      name: "📊 Current Pull Rates",
      value: rateLines.join("  |  "),
      inline: false,
    },
    {
      name: "🎯 Your Pity",
      value: [
        `Legendary pity: ${buildPityBar(pity, banner.hardPity)} **${pity}/${banner.hardPity}**`,
        pity >= banner.softPityStart
          ? `⚡ **Soft pity active!** +${((pity - banner.softPityStart + 1) * banner.softPityInc * 100).toFixed(1)}% legendary rate`
          : `Soft pity starts at pull **${banner.softPityStart}**`,
        `Epic pity: **${epicPity}/70**`,
        pityState.guaranteedRateUp ? "✅ **Guaranteed rate-up** on next legendary!" : "50/50 chance on next legendary",
      ].join("\n"),
      inline: false,
    },
    {
      name: "💎 Cost",
      value: `Single: **${banner.gemCost}** gems  |  10x: **${banner.tenPullCost}** gems *(10% off)*`,
      inline: true,
    },
    {
      name: "💰 Your Gems",
      value: `**${character.currency.gems.toLocaleString()}** 💎`,
      inline: true,
    },
  );

  if (banner.type === "beginner") {
    const remaining = 20 - (pityState.pullCount ?? 0);
    embed.addFields({ name: "🌱 Beginner Pulls", value: `**${remaining}/20** pulls remaining`, inline: true });
  }

  // Buttons
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_GACHA_PULL1_${banner.bannerId}`)
      .setLabel(`🎰 Pull ×1 (${banner.gemCost} 💎)`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canAfford1),
    new ButtonBuilder()
      .setCustomId(`B_GACHA_PULL10_${banner.bannerId}`)
      .setLabel(`🎰 Pull ×10 (${banner.tenPullCost} 💎)`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canAfford10),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("B_GACHA_LIST")
      .setLabel("← All Banners")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`B_GACHA_PITY_${banner.bannerId}`)
      .setLabel("🎯 Full Pity Info")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row1, row2] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PULL RESULTS — after pulling
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object[]}    results    — array of pull result objects
 * @param {GachaBanner} banner
 * @param {GachaPlayer} player
 * @param {Character}   character
 */
function buildPullResultEmbed(results, banner, player, character) {
  const sorted   = sortByRarity(results);
  const best     = sorted[0];
  const bestCfg  = RARITY_CONFIG[best.rarity];

  // Color based on best rarity in pull
  const embed = new EmbedBuilder()
    .setColor(bestCfg?.color ?? 0x9B59B6)
    .setTitle(`${banner.emoji} ${results.length === 1 ? "Pull Result" : "10x Pull Results"}`)
    .setFooter({ text: `💎 Remaining: ${character.currency.gems.toLocaleString()} gems  ⭐ Stardust: ${player.stardust.toLocaleString()}` });

  // Summary line
  const counts = {};
  for (const r of results) counts[r.rarity] = (counts[r.rarity] ?? 0) + 1;
  const summaryLine = RARITY_ORDER
    .filter(r => counts[r])
    .map(r => `${RARITY_CONFIG[r].emoji} ×${counts[r]}`)
    .join("  ");
  embed.setDescription(`**Results:** ${summaryLine}`);

  // Individual results
  const lines = [];
  for (const result of sorted) {
    const cfg    = RARITY_CONFIG[result.rarity];
    const tags   = [
      result.wasPity    ? "💯 PITY"      : null,
      result.wasRateUp  ? "⭐ RATE-UP"   : null,
      result.isDupe     ? "🔁 DUPE"      : null,
      result.isFeatured ? "🌟 FEATURED"  : null,
    ].filter(Boolean).join(" ");

    lines.push(
      `${result.emoji} **${result.name}** — ${cfg.emoji} ${cfg.label}${tags ? `  \`${tags}\`` : ""}`
      + (result.isDupe ? `  *(+${cfg.stardustValue} ⭐ stardust)*` : "")
    );
  }

  embed.addFields({ name: "📦 Items Obtained", value: lines.join("\n").substring(0, 1024), inline: false });

  // Highlight legendary/mythic
  const highlights = sorted.filter(r => ["legendary","mythic","unique"].includes(r.rarity));
  if (highlights.length > 0) {
    const hlLines = highlights.map(r => {
      const parts = [`${r.emoji} **${r.name}**`];
      if (r.passive)   parts.push(`*Passive: ${r.passive}*`);
      if (r.statBonus) {
        const bonuses = Object.entries(r.statBonus)
          .map(([k, v]) => `${k} +${typeof v === "number" && v < 1 ? `${Math.round(v*100)}%` : v}`)
          .join(", ");
        parts.push(`Stats: ${bonuses}`);
      }
      return parts.join("\n");
    });
    embed.addFields({ name: "✨ New Legendary/Mythic!", value: hlLines.join("\n\n").substring(0, 1024), inline: false });
  }

  // Pull again buttons
  const pityState = player.getPityState(banner.bannerId);
  const canAfford1  = character.currency.gems >= banner.gemCost;
  const canAfford10 = character.currency.gems >= banner.tenPullCost;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_GACHA_PULL1_${banner.bannerId}`)
      .setLabel(`🎰 Pull Again ×1`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canAfford1),
    new ButtonBuilder()
      .setCustomId(`B_GACHA_PULL10_${banner.bannerId}`)
      .setLabel(`🎰 Pull ×10`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canAfford10),
    new ButtonBuilder()
      .setCustomId("B_GACHA_LIST")
      .setLabel("← Banners")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PULL HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaPlayer} player
 * @param {string|null} bannerId  — filter by banner, or null for all
 */
function buildHistoryEmbed(player, bannerId = null) {
  const history = bannerId
    ? player.getBannerHistory(bannerId, 30)
    : [...player.pullHistory].reverse().slice(0, 30);

  const embed = new EmbedBuilder()
    .setColor(0x2C3E50)
    .setTitle("📜 Pull History")
    .setDescription(
      `Total Pulls: **${player.totalPulls}**  ` +
      `Legendaries: **${player.totalLegendary}**  ` +
      `Epics: **${player.totalEpic}**`
    )
    .setFooter({ text: "Showing last 30 pulls" });

  if (!history.length) {
    embed.addFields({ name: "No pulls yet", value: "Start pulling to build your collection!", inline: false });
    return embed;
  }

  // Group by rarity
  const lines = history.map(p => {
    const cfg  = RARITY_CONFIG[p.rarity];
    const tags = [p.wasPity ? "PITY" : null, p.wasRateUp ? "RATE-UP" : null].filter(Boolean);
    const time = `<t:${Math.floor(new Date(p.pulledAt).getTime() / 1000)}:d>`;
    return `${cfg?.emoji ?? "•"} **${p.itemName}** ${tags.length ? `\`${tags.join(" ")}\`` : ""} — ${time}`;
  });

  embed.addFields({ name: "Recent Pulls", value: lines.join("\n").substring(0, 1024), inline: false });
  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PITY DETAILS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaBanner} banner
 * @param {GachaPlayer} player
 */
function buildPityEmbed(banner, player) {
  const pityState  = player.getPityState(banner.bannerId);
  const pity       = pityState.pityCounter ?? 0;
  const epicPity   = pityState.epicPityCounter ?? 0;
  const GachaEngine = require("./gachaEngine");
  const rates       = GachaEngine.getRates(banner, pityState);
  const legendRate  = (rates.legendary * 100).toFixed(3);
  const epicRate    = (rates.epic * 100).toFixed(2);

  const isSoftPity = pity >= banner.softPityStart;
  const pullsToHard = banner.hardPity - pity;
  const pullsToSoft = Math.max(0, banner.softPityStart - pity);

  const embed = new EmbedBuilder()
    .setColor(isSoftPity ? 0xF39C12 : 0x2980B9)
    .setTitle(`🎯 Pity Details — ${banner.name}`)
    .addFields(
      {
        name: "⭐ Legendary Pity",
        value: [
          `Current pity: **${pity}** / **${banner.hardPity}** (hard pity)`,
          `${buildPityBar(pity, banner.hardPity, 20)}`,
          isSoftPity
            ? `⚡ **Soft pity ACTIVE** — Current rate: **${legendRate}%** (was ${(BASE_RATE_LEGEND * 100).toFixed(3)}%)`
            : `Soft pity starts at pull **${banner.softPityStart}** (${pullsToSoft} pulls away)`,
          `Hard pity (guaranteed) in: **${pullsToHard}** pulls`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🟪 Epic Pity",
        value: [
          `Current epic pity: **${epicPity}** / **70**`,
          `Current epic rate: **${epicRate}%**`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🎲 50/50 Status",
        value: pityState.guaranteedRateUp
          ? "✅ **GUARANTEED** — Next legendary/mythic is a rate-up item!"
          : "🎲 **50/50** — Next legendary has a 50% chance of being rate-up",
        inline: false,
      },
      {
        name: "📊 This Banner",
        value: [
          `Total pulls: **${pityState.pullCount ?? 0}**`,
          `Soft pity starts: pull **${banner.softPityStart}** (+${(banner.softPityInc * 100).toFixed(0)}% per pull)`,
          `Hard pity: pull **${banner.hardPity}** (guaranteed legendary)`,
        ].join("\n"),
        inline: false,
      },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_GACHA_BANNER_${banner.bannerId}`)
      .setLabel("← Back to Banner")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STARDUST SHOP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaPlayer} player
 */
function buildStardustShopEmbed(player) {
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle("⭐ Stardust Shop")
    .setDescription(
      `Your Stardust: **${player.stardust.toLocaleString()} ⭐**\n\n` +
      `Earn stardust by pulling duplicate items. Higher rarity dupes give more stardust.`
    );

  for (const item of STARDUST_SHOP) {
    embed.addFields({
      name: `${item.name} — ${item.cost.toLocaleString()} ⭐`,
      value: item.description,
      inline: true,
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("S_GACHA_SHOP_BUY")
    .setPlaceholder("Purchase an item...")
    .addOptions(
      STARDUST_SHOP.map(item => ({
        label:       item.name,
        description: `${item.cost.toLocaleString()} ⭐ — ${item.description.substring(0, 50)}`,
        value:       item.id,
        emoji:       "⭐",
      }))
    );

  const backBtn = new ButtonBuilder()
    .setCustomId("B_GACHA_LIST")
    .setLabel("← Back to Banners")
    .setStyle(ButtonStyle.Secondary);

  return {
    embed,
    rows: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(backBtn),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTION — /gacha collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {GachaPlayer} player
 * @param {string}      filterRarity  — "all" | "legendary" | "epic" | ...
 * @param {number}      page
 */
function buildCollectionEmbed(player, filterRarity = "all", page = 0) {
  const ITEMS_PER_PAGE = 10;
  let items = [...player.ownedItems];

  if (filterRarity !== "all") {
    items = items.filter(i => i.rarity === filterRarity);
  }

  // Sort by rarity desc, then name
  items.sort((a, b) => {
    const ri = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    return ri !== 0 ? ri : a.itemName.localeCompare(b.itemName);
  });

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const pageItems  = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(0x8E44AD)
    .setTitle("📚 Your Collection")
    .setDescription(
      `**${items.length}** items owned  |  ⭐ **${player.stardust.toLocaleString()}** stardust\n` +
      `Filter: **${filterRarity === "all" ? "All" : RARITY_CONFIG[filterRarity]?.label ?? filterRarity}**`
    )
    .setFooter({ text: `Page ${page + 1} / ${totalPages}` });

  if (!pageItems.length) {
    embed.addFields({ name: "Empty", value: "No items match this filter.", inline: false });
  } else {
    for (const item of pageItems) {
      const cfg = RARITY_CONFIG[item.rarity];
      embed.addFields({
        name: `${item.emoji} ${item.itemName}`,
        value: [
          `${cfg?.emoji} ${cfg?.label ?? item.rarity}`,
          item.count > 1 ? `Copies: **${item.count}** (+${item.stardust} ⭐)` : "✨ First copy",
          `Obtained: <t:${Math.floor(new Date(item.firstPulled).getTime() / 1000)}:d>`,
        ].join("  |  "),
        inline: false,
      });
    }
  }

  // Pagination + filter buttons
  const filterRow = new ActionRowBuilder().addComponents(
    ...(["all","legendary","epic","rare"].map(r =>
      new ButtonBuilder()
        .setCustomId(`B_GACHA_COLL_FILTER_${r}_0`)
        .setLabel(r === "all" ? "All" : RARITY_CONFIG[r]?.label ?? r)
        .setStyle(r === filterRarity ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ))
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_GACHA_COLL_PAGE_${filterRarity}_${page - 1}`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`B_GACHA_COLL_PAGE_${filterRarity}_${page + 1}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("B_GACHA_LIST")
      .setLabel("🎰 Banners")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [filterRow, navRow] };
}

// ─── Pity bar helper ──────────────────────────────────────────────────────────
const BASE_RATE_LEGEND = 0.006;

function buildPityBar(current, max, length = 15) {
  const ratio  = Math.min(1, current / max);
  const filled = Math.round(ratio * length);
  const color  = ratio >= 0.85 ? "🟥" : ratio >= 0.60 ? "🟧" : "🟩";
  return color.repeat(filled) + "⬜".repeat(length - filled);
}

module.exports = {
  buildBannerListEmbed,
  buildBannerDetailEmbed,
  buildPullResultEmbed,
  buildHistoryEmbed,
  buildPityEmbed,
  buildStardustShopEmbed,
  buildCollectionEmbed,
  buildPityBar,
};
