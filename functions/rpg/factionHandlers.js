// functions/rpg/factionHandlers.js
// ─────────────────────────────────────────────────────────────────────────────
// Button handlers:
//   B_FACTION_JOIN_{factionId}   → quick join
//   B_FACTION_MEMBERS_{page}     → paginate members
//   B_WAR_ROSTER_{warId}         → join relay roster
//   B_WAR_STATUS_{warId}         → refresh war status
//   B_WAR_RELAY_{warId}          → advance relay round (auto-resolve)
//   B_WAR_SIEGE_{warId}          → attack siege target
//
// Also exports WarScheduler — checks preparation phase expiry via setInterval.
// ─────────────────────────────────────────────────────────────────────────────

const Character   = require("../../models/Character");
const Faction     = require("../../models/Faction");
const FactionWar  = require("../../models/FactionWar");
const WarEngine   = require("./warEngine");
const FactionEngine = require("./factionEngine");
const {
  buildWarStatusEmbed, buildWarResultEmbed, buildMemberListEmbed,
} = require("./factionUI");

// ─── Shared loader ────────────────────────────────────────────────────────────
async function _loadChar(userId, guildId) {
  return Character.findCharacter(userId, guildId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// B_FACTION_JOIN_{factionId}
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.factionJoin = {
  data: { name: "B_FACTION_JOIN", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const factionId = interaction.customId.split("_").slice(3).join("_");
    const char      = await _loadChar(interaction.user.id, interaction.guildId);
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const faction = await Faction.findById(factionId);
    if (!faction) return interaction.followUp({ content: "❌ Faction not found.", ephemeral: true });

    const { ok, error } = await FactionEngine.join(faction, char);
    if (!ok) return interaction.followUp({ content: error, ephemeral: true });

    return interaction.followUp({ content: `✅ Joined **${faction.emoji} ${faction.name}**!`, ephemeral: true });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_FACTION_MEMBERS_{page}
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.factionMembers = {
  data: { name: "B_FACTION_MEMBERS", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const page  = parseInt(interaction.customId.split("_").at(-1) ?? "0", 10);
    const char  = await _loadChar(interaction.user.id, interaction.guildId);
    if (!char?.factionId) return interaction.followUp({ content: "❌ Not in a faction.", ephemeral: true });

    const faction = await Faction.findById(char.factionId);
    if (!faction)  return interaction.followUp({ content: "❌ Faction not found.", ephemeral: true });

    const memberChars = await Character.find({ userId: { $in: faction.members.map(m => m.userId) }, guildId: faction.guildId }).lean();
    const { embed, rows } = buildMemberListEmbed(faction, memberChars, Math.max(0, page));
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_WAR_ROSTER_{warId} — sign up for relay battle
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.warRosterBtn = {
  data: { name: "B_WAR_ROSTER", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const warId = interaction.customId.split("_").slice(3).join("_");
    const char  = await _loadChar(interaction.user.id, interaction.guildId);
    if (!char)  return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const war = await FactionWar.findById(warId);
    if (!war)  return interaction.followUp({ content: "❌ War not found.", ephemeral: true });

    // Auto-assign position (next available)
    const { team } = war.getTeam(char.factionId?.toString() ?? "");
    if (!team) return interaction.followUp({ content: "❌ Your faction is not in this war.", ephemeral: true });

    const position = team.roster.length + 1;
    const { ok, error } = await WarEngine.joinRoster(war, char, position);
    if (!ok) return interaction.followUp({ content: error, ephemeral: true });

    const embed = buildWarStatusEmbed(await FactionWar.findById(warId));
    return interaction.editReply({ embeds: [embed] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_WAR_STATUS_{warId} — refresh status embed
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.warStatus = {
  data: { name: "B_WAR_STATUS", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const warId = interaction.customId.split("_").slice(3).join("_");
    const war   = await FactionWar.findById(warId);
    if (!war)   return interaction.followUp({ content: "❌ War not found.", ephemeral: true });

    const char = await _loadChar(interaction.user.id, interaction.guildId);
    const { buildWarActionRows } = require("../rpg/factionHandlers");
    const embed = buildWarStatusEmbed(war);

    const rows = _buildWarActionRows(war, char?.factionId?.toString() ?? "");
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_WAR_RELAY_{warId} — trigger next relay round
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.warRelay = {
  data: { name: "B_WAR_RELAY", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const warId = interaction.customId.split("_").slice(3).join("_");
    const war   = await FactionWar.findById(warId);
    if (!war)   return interaction.followUp({ content: "❌ War not found.", ephemeral: true });
    if (war.phase !== "relay") return interaction.followUp({ content: "❌ Not in relay phase.", ephemeral: true });

    // Only faction leaders/officers can advance the round
    const char    = await _loadChar(interaction.user.id, interaction.guildId);
    const faction = char?.factionId ? await Faction.findById(char.factionId) : null;
    if (!faction?.isLeaderOrOfficer(interaction.user.id)) {
      return interaction.followUp({ content: "❌ Only leaders/officers can advance the relay round.", ephemeral: true });
    }

    const { battle, war: updatedWar, ended } = await WarEngine.resolveRelayRound(war, war.currentRound);

    if (ended) {
      const resultEmbed = buildWarResultEmbed(updatedWar);
      return interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    const embed = buildWarStatusEmbed(updatedWar);
    const rows  = _buildWarActionRows(updatedWar, char.factionId?.toString() ?? "");
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_WAR_SIEGE_{warId} — attack siege target
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.warSiege = {
  data: { name: "B_WAR_SIEGE", type: "any", enable: true },
  execute: async (interaction) => {
    await interaction.deferUpdate();
    const warId = interaction.customId.split("_").slice(3).join("_");

    const [war, char] = await Promise.all([
      FactionWar.findById(warId),
      _loadChar(interaction.user.id, interaction.guildId),
    ]);
    if (!war)  return interaction.followUp({ content: "❌ War not found.", ephemeral: true });
    if (!char) return interaction.followUp({ content: "❌ No character.", ephemeral: true });

    const { damage, log, siegeEnded } = await WarEngine.attackSiege(war, char);
    if (!damage && log.startsWith("❌")) return interaction.followUp({ content: log, ephemeral: true });

    if (siegeEnded) {
      const finishedWar   = await FactionWar.findById(warId);
      const resultEmbed   = buildWarResultEmbed(finishedWar);
      return interaction.editReply({ content: `⚔️ ${log}`, embeds: [resultEmbed], components: [] });
    }

    const refreshedWar  = await FactionWar.findById(warId);
    const embed         = buildWarStatusEmbed(refreshedWar);
    const rows          = _buildWarActionRows(refreshedWar, char.factionId?.toString() ?? "");
    return interaction.editReply({ content: `⚔️ ${log}`, embeds: [embed], components: rows });
  },
};

// ─── Build war action rows (shared) ──────────────────────────────────────────
function _buildWarActionRows(war, factionId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  const rows = [];

  if (war.phase === "preparation") {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`B_WAR_ROSTER_${war._id}`).setLabel("✋ Join Roster").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`B_WAR_STATUS_${war._id}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
    ));
  }

  if (war.phase === "relay") {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`B_WAR_RELAY_${war._id}`).setLabel("⚔️ Next Round (Officers only)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`B_WAR_STATUS_${war._id}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
    ));
  }

  if (war.phase === "siege") {
    const attackerSide = war.alphaScore >= war.betaScore ? "alpha" : "beta";
    const playerSide   = war.alpha?.roster?.some(p => p.userId === factionId) ? "alpha"
                       : war.beta?.roster?.some(p => p.userId === factionId)  ? "beta"
                       : null;
    // Rough check — proper side check happens server-side in WarEngine
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`B_WAR_SIEGE_${war._id}`)
        .setLabel("🏹 Attack Siege (5 ⚡)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`B_WAR_STATUS_${war._id}`)
        .setLabel("🔄 Refresh")
        .setStyle(ButtonStyle.Secondary),
    ));
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAR SCHEDULER — runs every 60 seconds, handles phase transitions
// ═══════════════════════════════════════════════════════════════════════════════

class WarScheduler {
  /**
   * @param {import("discord.js").Client} client
   */
  static start(client) {
    setInterval(() => WarScheduler._tick(client), 60 * 1000);
    console.log("[WarScheduler] Started — checking war phases every 60s.");
  }

  static async _tick(client) {
    try {
      const now         = new Date();
      const activeWars  = await FactionWar.find({ active: true });

      for (const war of activeWars) {
        // Preparation → Relay
        if (war.phase === "preparation" && war.preparationEnds && now >= new Date(war.preparationEnds)) {
          const { ok } = await WarEngine.startRelay(war);
          if (ok) {
            await WarScheduler._announcePhase(client, war, "⚔️ **Relay Phase has started!** Leaders can now advance rounds with the button.");
          }
        }

        // War timeout — resolve if past warEndsAt
        if (war.active && war.warEndsAt && now >= new Date(war.warEndsAt)) {
          await WarEngine._resolveWar(war);
          await WarScheduler._announcePhase(client, war, "⏰ **War timed out!** Results have been calculated.");
        }
      }

      // Reset cooldown → idle
      const cooldownFactions = await Faction.find({ warStatus: "cooldown", warCooldownUntil: { $lte: now } });
      for (const f of cooldownFactions) {
        f.warStatus = "idle";
        await f.save();
      }
    } catch (err) {
      console.error("[WarScheduler] Tick error:", err.message);
    }
  }

  static async _announcePhase(client, war, message) {
    if (!war.channelId) return;
    try {
      const channel = await client.channels.fetch(war.channelId);
      if (channel?.isTextBased()) {
        const embed = require("./factionUI").buildWarStatusEmbed(war);
        await channel.send({ content: message, embeds: [embed] });
      }
    } catch (_) { /* Channel may be unavailable */ }
  }
}

module.exports.WarScheduler = WarScheduler;
