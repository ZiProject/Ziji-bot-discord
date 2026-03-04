// functions/rpg/factionUI.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
        StringSelectMenuBuilder } = require("discord.js");
const { TERRITORIES, HALL_UPGRADES, RELAY_CONFIG, getUpgradeCost } = require("../../data/factions");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RANK_EMOJI = { leader: "👑", officer: "⭐", elite: "💠", member: "👤" };

function hpBar(current, max, len = 12) {
  const ratio  = Math.min(1, Math.max(0, current / max));
  const filled = Math.round(ratio * len);
  const color  = ratio > 0.6 ? "🟩" : ratio > 0.3 ? "🟧" : "🟥";
  return color.repeat(filled) + "⬛".repeat(len - filled);
}

function scoreBar(a, b, len = 14) {
  const total = Math.max(1, a + b);
  const aLen  = Math.round((a / total) * len);
  const bLen  = len - aLen;
  return "🔵".repeat(aLen) + "🔴".repeat(bLen);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTION INFO
// ═══════════════════════════════════════════════════════════════════════════════

function buildFactionEmbed(faction, memberChars = []) {
  const leader = memberChars.find(c => c.userId === faction.leaderId);

  const embed = new EmbedBuilder()
    .setColor(faction.color ?? 0x2980B9)
    .setTitle(`${faction.emoji} [${faction.tag}] ${faction.name}`)
    .setDescription(faction.description || "*No description set.*")
    .addFields(
      {
        name: "📊 Overview",
        value: [
          `**Level:** ${faction.level}  |  **XP:** ${faction.xp.toLocaleString()} / ${Math.floor(500 * Math.pow(faction.level, 1.5)).toLocaleString()}`,
          `**Power Score:** ⚡ ${faction.powerScore.toLocaleString()}`,
          `**Members:** ${faction.members.length}/${faction.maxMembers}`,
          `**Leader:** ${leader?.name ?? "Unknown"}`,
          `**Record:** ${faction.warWins}W — ${faction.warLosses}L`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🏰 Treasury",
        value: [
          `🪙 Gold: **${faction.factionGold.toLocaleString()}**`,
          `🎖️ Tokens: **${faction.factionTokens.toLocaleString()}**`,
        ].join("  |  "),
        inline: false,
      },
    );

  // Territories
  if (faction.territories.length > 0) {
    embed.addFields({
      name: `🗺️ Territories (${faction.territories.length})`,
      value: faction.territories.map(t => {
        const def = TERRITORIES[t.territoryId];
        return `${def?.emoji ?? "📍"} **${t.name}** — ${def?.description ?? "Bonus active"}`;
      }).join("\n").substring(0, 1024),
      inline: false,
    });
  }

  // Hall upgrades
  const activeUpgrades = faction.hallUpgrades.filter(u => u.level > 0);
  if (activeUpgrades.length > 0) {
    embed.addFields({
      name: "🏛️ Faction Hall",
      value: activeUpgrades.map(u => {
        const def = HALL_UPGRADES[u.upgradeId];
        return `${def?.emoji ?? "🔧"} **${u.name}** Lv${u.level}`;
      }).join("  |  ").substring(0, 1024),
      inline: false,
    });
  }

  // War status
  const warStatusLine = {
    idle:       "🟢 Available for war",
    in_war:     "⚔️ Currently at war!",
    cooldown:   faction.warCooldownUntil
      ? `⏳ War cooldown until <t:${Math.floor(new Date(faction.warCooldownUntil).getTime()/1000)}:R>`
      : "⏳ On cooldown",
    searching:  "🔍 Searching for opponent",
  };
  embed.addFields({ name: "⚔️ War Status", value: warStatusLine[faction.warStatus] ?? "Unknown", inline: false });

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBER LIST
// ═══════════════════════════════════════════════════════════════════════════════

function buildMemberListEmbed(faction, memberChars = [], page = 0) {
  const PER_PAGE = 10;
  const sorted   = [...faction.members].sort((a, b) => {
    const rankOrder = { leader:0, officer:1, elite:2, member:3 };
    return (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9) || b.contribution - a.contribution;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paginated  = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(faction.color ?? 0x2980B9)
    .setTitle(`${faction.emoji} ${faction.name} — Members`)
    .setDescription(`${faction.members.length}/${faction.maxMembers} members`)
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });

  for (const member of paginated) {
    const char = memberChars.find(c => c.userId === member.userId);
    embed.addFields({
      name: `${RANK_EMOJI[member.rank] ?? "👤"} ${char?.name ?? member.userId}`,
      value: [
        `${char ? `Lv ${char.level} ${char.class}` : "Unknown"}`,
        `Contribution: **${member.contribution.toLocaleString()}** 🪙`,
        `War Contrib: **${member.warContrib.toLocaleString()}** dmg`,
      ].join("  |  "),
      inline: false,
    });
  }

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_FACTION_MEMBERS_${page - 1}`)
      .setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`B_FACTION_MEMBERS_${page + 1}`)
      .setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );

  return { embed, rows: [navRow] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERRITORY MAP
// ═══════════════════════════════════════════════════════════════════════════════

function buildTerritoryMapEmbed(faction, allFactions = []) {
  const embed = new EmbedBuilder()
    .setColor(faction.color ?? 0x2980B9)
    .setTitle("🗺️ Territory Map")
    .setDescription(`Showing all territories and their current controllers.`);

  const typeGroups = {
    mine:         { label: "⛏️ Mines",         ids: [] },
    fortress:     { label: "🏰 Fortresses",     ids: [] },
    shrine:       { label: "⛩️ Shrines",        ids: [] },
    market:       { label: "🏪 Markets",        ids: [] },
    dungeon_gate: { label: "🌀 Dungeon Gates",  ids: [] },
  };

  for (const id of Object.keys(TERRITORIES)) {
    const def = TERRITORIES[id];
    typeGroups[def.type]?.ids.push(id);
  }

  for (const group of Object.values(typeGroups)) {
    if (!group.ids.length) continue;

    const lines = group.ids.map(id => {
      const def       = TERRITORIES[id];
      const owner     = allFactions.find(f => f.territories.some(t => t.territoryId === id));
      const isMine    = faction.territories.some(t => t.territoryId === id);
      const ownerTag  = owner ? `[${owner.tag}] ${owner.name}` : "Neutral";
      const icon      = isMine ? "✅" : owner ? "🔴" : "⬜";

      return `${icon} **${def.name}** ${def.emoji} — ${ownerTag}\n  └ *${def.description}*`;
    });

    embed.addFields({ name: group.label, value: lines.join("\n").substring(0, 1024), inline: false });
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HALL UPGRADES
// ═══════════════════════════════════════════════════════════════════════════════

function buildHallEmbed(faction) {
  const embed = new EmbedBuilder()
    .setColor(faction.color ?? 0x2980B9)
    .setTitle(`🏛️ ${faction.name} — Faction Hall`)
    .setDescription([
      `🪙 Treasury: **${faction.factionGold.toLocaleString()}** gold`,
      `🎖️ Tokens: **${faction.factionTokens.toLocaleString()}**`,
    ].join("  |  "));

  for (const [id, def] of Object.entries(HALL_UPGRADES)) {
    const current  = faction.hallUpgrades.find(u => u.upgradeId === id)?.level ?? 0;
    const isMaxed  = current >= def.maxLevel;
    const cost     = isMaxed ? null : getUpgradeCost(id, current);
    const canAfford = cost
      ? faction.factionGold >= cost.gold && faction.factionTokens >= cost.tokens
      : false;

    embed.addFields({
      name: `${def.emoji} ${def.name} — Lv ${current}/${def.maxLevel}`,
      value: [
        def.effectPerLevel,
        isMaxed
          ? "✅ **MAX LEVEL**"
          : `Next upgrade: 🪙 ${cost.gold.toLocaleString()} + 🎖️ ${cost.tokens} tokens ${canAfford ? "*(affordable)*" : "*(insufficient funds)*"}`,
      ].join("\n"),
      inline: true,
    });
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAR DECLARATION
// ═══════════════════════════════════════════════════════════════════════════════

function buildWarDeclareEmbed(attacker, defender, targetTerritory) {
  const terrDef = targetTerritory ? TERRITORIES[targetTerritory] : null;

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle("⚔️ War Declaration")
    .setDescription([
      `**${attacker.emoji} ${attacker.name}** [${attacker.tag}]`,
      `has declared war on`,
      `**${defender.emoji} ${defender.name}** [${defender.tag}]`,
    ].join(" "))
    .addFields(
      { name: "⚡ Attacker Power", value: `${attacker.powerScore.toLocaleString()}`, inline: true },
      { name: "⚡ Defender Power", value: `${defender.powerScore.toLocaleString()}`, inline: true },
      {
        name: "🏆 Contested Territory",
        value: terrDef
          ? `${terrDef.emoji} **${terrDef.name}** — ${terrDef.description}`
          : "No territory at stake (honour war)",
        inline: false,
      },
      {
        name: "📋 War Format",
        value: [
          `🔹 **Phase 1 — Preparation** (${RELAY_CONFIG.preparationTime} min): Assemble your 5-player roster`,
          `🔹 **Phase 2 — Relay Battle** (${RELAY_CONFIG.rounds} rounds): 5v5 relay fights`,
          `🔹 **Phase 3 — Siege**: Relay winner bombards the contested territory`,
          `🔹 **Resolution**: Winner claims the territory + rewards`,
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "All faction members: join the roster with /faction war roster" });

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAR STATUS (live)
// ═══════════════════════════════════════════════════════════════════════════════

function buildWarStatusEmbed(war) {
  const phaseLabel = {
    preparation: `⏳ Preparation — Ends <t:${Math.floor(new Date(war.preparationEnds).getTime()/1000)}:R>`,
    relay:       `⚔️ Relay Battle — Round **${war.currentRound}/${war.totalRounds}**`,
    siege:       `🏰 Siege Phase`,
    resolution:  `🏆 Resolution`,
    ended:       `✅ War Ended`,
  };

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`⚔️ Faction War — ${war.alpha.factionName} vs ${war.beta.factionName}`)
    .setDescription(phaseLabel[war.phase] ?? war.phase);

  // Score board
  embed.addFields({
    name: "📊 Score",
    value: [
      `🔵 **${war.alpha.factionName}** [${war.alpha.factionTag}]  vs  **${war.beta.factionName}** [${war.beta.factionTag}] 🔴`,
      `${scoreBar(war.alphaScore, war.betaScore)}`,
      `**${war.alphaScore}** pts — **${war.betaScore}** pts`,
    ].join("\n"),
    inline: false,
  });

  // Roster display
  for (const side of ["alpha", "beta"]) {
    const team = war[side];
    const icon = side === "alpha" ? "🔵" : "🔴";
    const rosterLines = team.roster.length > 0
      ? team.roster.map((p, i) =>
          `${i + 1}. **${p.name}** Lv${p.level} ${p.class} — ${hpBar(p.hp, p.maxHp, 8)} ${p.hp}/${p.maxHp}`
        ).join("\n")
      : "*No roster yet*";

    embed.addFields({
      name: `${icon} ${team.factionName} Roster`,
      value: rosterLines.substring(0, 1024),
      inline: true,
    });
  }

  // Last relay battle
  if (war.relayBattles.length > 0) {
    const last = war.relayBattles[war.relayBattles.length - 1];
    embed.addFields({
      name: `⚔️ Last Battle — Round ${last.roundNumber}`,
      value: [
        `**${last.attackerName}** vs **${last.defenderName}**`,
        `Result: **${last.result.toUpperCase()}** for attacker`,
        last.log.slice(-3).join("\n"),
      ].join("\n").substring(0, 1024),
      inline: false,
    });
  }

  // Siege HP
  if (war.phase === "siege" && war.siegeTerritory) {
    const terrDef = TERRITORIES[war.siegeTerritory];
    embed.addFields({
      name: `🏰 Siege: ${terrDef?.emoji ?? ""} ${terrDef?.name ?? war.siegeTerritory}`,
      value: [
        `${hpBar(war.siegeHp, war.siegeMaxHp, 16)} **${war.siegeHp.toLocaleString()}/${war.siegeMaxHp.toLocaleString()}** HP`,
        `*Relay winner's faction members can attack with \`Attack Siege\` button*`,
      ].join("\n"),
      inline: false,
    });
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAR RESULT
// ═══════════════════════════════════════════════════════════════════════════════

function buildWarResultEmbed(war) {
  const isDraw   = war.alphaScore === war.betaScore;
  const winner   = !isDraw ? (war.alphaScore > war.betaScore ? war.alpha : war.beta) : null;
  const loser    = !isDraw ? (war.alphaScore > war.betaScore ? war.beta  : war.alpha) : null;

  const embed = new EmbedBuilder()
    .setColor(isDraw ? 0x95A5A6 : 0xF39C12)
    .setTitle(isDraw ? "🤝 War — Draw!" : `🏆 ${winner.factionName} wins the war!`)
    .setDescription(isDraw
      ? `**${war.alpha.factionName}** and **${war.beta.factionName}** fought to a draw.`
      : `**${winner.factionName}** [${winner.factionTag}] defeated **${loser.factionName}** [${loser.factionTag}]!`
    );

  embed.addFields(
    { name: "📊 Final Score",
      value: `🔵 ${war.alpha.factionName}: **${war.alphaScore}** pts\n🔴 ${war.beta.factionName}: **${war.betaScore}** pts`,
      inline: false },
    { name: "⚔️ Battles",
      value: `${war.relayBattles.length} relay rounds fought`,
      inline: true },
    { name: "🏰 Territory",
      value: war.siegeTerritory
        ? (isDraw ? "Contested — no change" : `${TERRITORIES[war.siegeTerritory]?.emoji} **${TERRITORIES[war.siegeTerritory]?.name}** → captured by ${winner.factionName}!`)
        : "No territory at stake",
      inline: true },
  );

  if (!isDraw) {
    embed.addFields({
      name: "🎁 Winner Rewards",
      value: `All members of **${winner.factionName}** receive:\n💎 **300 gems** + 🎖️ **500 faction tokens**`,
      inline: false,
    });
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function buildLeaderboardEmbed(factions) {
  const sorted = [...factions].sort((a, b) => b.powerScore - a.powerScore).slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle("🏆 Faction Leaderboard")
    .setDescription("Top 10 factions by power score.");

  const medals = ["🥇","🥈","🥉"];
  sorted.forEach((f, i) => {
    embed.addFields({
      name: `${medals[i] ?? `${i + 1}.`} [${f.tag}] ${f.name}`,
      value: [
        `⚡ Power: **${f.powerScore.toLocaleString()}**`,
        `👥 Members: **${f.members.length}/${f.maxMembers}**`,
        `📜 Record: ${f.warWins}W—${f.warLosses}L`,
        `🗺️ Territories: **${f.territories.length}**`,
      ].join("  |  "),
      inline: false,
    });
  });

  return embed;
}

module.exports = {
  buildFactionEmbed, buildMemberListEmbed, buildTerritoryMapEmbed,
  buildHallEmbed, buildWarDeclareEmbed, buildWarStatusEmbed,
  buildWarResultEmbed, buildLeaderboardEmbed, hpBar,
};
