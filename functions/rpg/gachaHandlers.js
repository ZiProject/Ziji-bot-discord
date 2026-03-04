// functions/rpg/gachaHandlers.js
// ─────────────────────────────────────────────────────────────────────────────
// All B_GACHA_* and S_GACHA_* interaction handlers.
//
// customId patterns:
//   B_GACHA_LIST                        → banner list
//   B_GACHA_PULL1_{bannerId}            → single pull
//   B_GACHA_PULL10_{bannerId}           → 10x pull
//   B_GACHA_BANNER_{bannerId}           → banner detail
//   B_GACHA_PITY_{bannerId}             → pity detail
//   B_GACHA_SHOP                        → stardust shop
//   B_GACHA_HISTORY                     → pull history
//   B_GACHA_COLL_FILTER_{rarity}_{page} → collection filter
//   B_GACHA_COLL_PAGE_{rarity}_{page}   → collection paginate
//   S_GACHA_BANNER_SELECT               → banner select menu
//   S_GACHA_SHOP_BUY                    → stardust shop purchase
// ─────────────────────────────────────────────────────────────────────────────

const Character   = require("../../models/Character");
const GachaBanner = require("../../models/GachaBanner");
const GachaPlayer = require("../../models/GachaPlayer");
const GachaEngine = require("./gachaEngine");
const {
  buildBannerListEmbed, buildBannerDetailEmbed, buildPullResultEmbed,
  buildHistoryEmbed,    buildPityEmbed,          buildStardustShopEmbed,
  buildCollectionEmbed,
} = require("./gachaUI");

// ─── Helper: load all three docs at once ─────────────────────────────────────
async function _load(userId, guildId) {
  const [char, player] = await Promise.all([
    Character.findCharacter(userId, guildId),
    GachaPlayer.findOrCreate(userId, guildId),
  ]);
  return { char, player };
}

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_LIST — show banner list
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaList = {
  data: { name: "B_GACHA_LIST", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { char, player } = await _load(interaction.user.id, interaction.guildId);
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const banners = await GachaBanner.find({ active: true }).lean();
    const { embed, rows } = buildBannerListEmbed(banners, player, char);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// S_GACHA_BANNER_SELECT — select menu → banner detail
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaBannerSelect = {
  data: { name: "S_GACHA_BANNER_SELECT", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const bannerId = interaction.values[0];
    const { char, player } = await _load(interaction.user.id, interaction.guildId);
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const banner = await GachaBanner.findOne({ bannerId, active: true }).lean();
    if (!banner) return interaction.followUp({ content: "❌ Banner not found.", ephemeral: true });

    const { embed, rows } = buildBannerDetailEmbed(banner, player, char);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_BANNER_{bannerId} — button → banner detail
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaBannerDetail = {
  data: { name: "B_GACHA_BANNER", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    // customId: B_GACHA_BANNER_{bannerId}  (bannerId may contain underscores)
    const bannerId = interaction.customId.split("_").slice(3).join("_");
    const { char, player } = await _load(interaction.user.id, interaction.guildId);
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const banner = await GachaBanner.findOne({ bannerId, active: true }).lean();
    if (!banner) return interaction.followUp({ content: "❌ Banner not found.", ephemeral: true });

    const { embed, rows } = buildBannerDetailEmbed(banner, player, char);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_PULL1_{bannerId} — single pull button
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaPull1 = {
  data: { name: "B_GACHA_PULL1", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const bannerId = interaction.customId.split("_").slice(3).join("_");
    await _executePull(interaction, bannerId, 1);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_PULL10_{bannerId} — 10x pull button
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaPull10 = {
  data: { name: "B_GACHA_PULL10", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const bannerId = interaction.customId.split("_").slice(3).join("_");
    await _executePull(interaction, bannerId, 10);
  },
};

// ─── Shared pull executor ────────────────────────────────────────────────────
async function _executePull(interaction, bannerId, count) {
  const { char, player } = await _load(interaction.user.id, interaction.guildId);
  if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

  const banner = await GachaBanner.findOne({ bannerId, active: true });
  if (!banner) return interaction.followUp({ content: "❌ Banner not found.", ephemeral: true });

  const { ok, reason } = GachaEngine.canPull(player, banner, count, char);
  if (!ok) return interaction.followUp({ content: reason, ephemeral: true });

  const { results, totalCost } = GachaEngine.pull(player, banner, count, char);

  // Apply material rewards
  await _applyMaterialRewards(char, results);
  await Promise.all([char.save(), player.save(), banner.save()]);

  const { embed, rows } = buildPullResultEmbed(results, banner, player, char);
  return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_PITY_{bannerId} — pity detail
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaPity = {
  data: { name: "B_GACHA_PITY", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const bannerId = interaction.customId.split("_").slice(3).join("_");
    const player   = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
    const banner   = await GachaBanner.findOne({ bannerId, active: true }).lean();
    if (!banner) return interaction.followUp({ content: "❌ Banner not found.", ephemeral: true });

    const { embed, rows } = buildPityEmbed(banner, player);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_SHOP — stardust shop
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaShop = {
  data: { name: "B_GACHA_SHOP", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
    const { embed, rows } = buildStardustShopEmbed(player);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// S_GACHA_SHOP_BUY — purchase from stardust shop
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaShopBuy = {
  data: { name: "S_GACHA_SHOP_BUY", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const shopItemId     = interaction.values[0];
    const { char, player } = await _load(interaction.user.id, interaction.guildId);
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const { ok, reason, reward } = GachaEngine.purchaseStardust(player, shopItemId, char);
    if (!ok) return interaction.followUp({ content: reason, ephemeral: true });

    await Promise.all([char.save(), player.save()]);

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`✅ Purchase Successful!`)
      .setDescription(
        `**${reward.name}** purchased!\n${reward.detail}\n\n⭐ Remaining Stardust: **${player.stardust.toLocaleString()}**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("B_GACHA_SHOP").setLabel("← Back to Shop").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("B_GACHA_LIST").setLabel("🎰 Banners").setStyle(ButtonStyle.Primary),
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_HISTORY — pull history
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaHistory = {
  data: { name: "B_GACHA_HISTORY", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
    const embed  = buildHistoryEmbed(player, null);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("B_GACHA_LIST").setLabel("← Banners").setStyle(ButtonStyle.Secondary),
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_GACHA_COLL_FILTER_{rarity}_{page} — collection filter
// B_GACHA_COLL_PAGE_{rarity}_{page}   — collection paginate
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.gachaCollFilter = {
  data: { name: "B_GACHA_COLL_FILTER", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    // B_GACHA_COLL_FILTER_{rarity}_{page}
    const parts  = interaction.customId.split("_");
    const rarity = parts[4];
    const page   = parseInt(parts[5] ?? "0", 10);
    const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
    const { embed, rows } = buildCollectionEmbed(player, rarity, Math.max(0, page));
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

module.exports.gachaCollPage = {
  data: { name: "B_GACHA_COLL_PAGE", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    // B_GACHA_COLL_PAGE_{rarity}_{page}
    const parts  = interaction.customId.split("_");
    const rarity = parts[4];
    const page   = parseInt(parts[5] ?? "0", 10);
    const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
    const { embed, rows } = buildCollectionEmbed(player, rarity, Math.max(0, page));
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────
async function _applyMaterialRewards(char, results) {
  for (const result of results) {
    if (result.type !== "material") continue;
    switch (result.itemId) {
      case "material_summon_crystal": char.currency.gems  += 50;   break;
      case "material_hero_xp":        char.awardXP(500);            break;
      case "material_gold_pouch":     char.currency.gold  += 1000;  break;
      default: {
        const slot = char.inventory.find(i => i.itemId === result.itemId);
        if (slot) slot.quantity++;
        else char.inventory.push({ itemId: result.itemId, quantity: 1 });
      }
    }
  }
}
