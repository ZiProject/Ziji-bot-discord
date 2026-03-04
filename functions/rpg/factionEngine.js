// functions/rpg/factionEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles all non-war faction logic:
//   create, disband, join, leave, kick, promote
//   donate, upgrade hall, territory capture (outside war)
//   daily income distribution
// ─────────────────────────────────────────────────────────────────────────────

const Faction    = require("../../models/Faction");
const Character  = require("../../models/Character");
const { HALL_UPGRADES, TERRITORIES, getUpgradeCost } = require("../../data/factions");

// ─── Cost to create a faction ─────────────────────────────────────────────────
const FACTION_CREATE_COST = { gold: 10000 };

class FactionEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {{ userId, guildId, name, tag, emoji, description }} opts
   * @param {Character} char
   * @returns {{ faction: Faction|null, error: string|null }}
   */
  static async create({ userId, guildId, name, tag, emoji, description }, char) {
    // Already in a faction?
    if (char.factionId) {
      return { faction: null, error: "❌ You are already in a faction. Leave it first." };
    }

    // Gold cost
    if (char.currency.gold < FACTION_CREATE_COST.gold) {
      return { faction: null, error: `❌ Creating a faction costs **${FACTION_CREATE_COST.gold.toLocaleString()}** 🪙 gold.` };
    }

    // Name/tag uniqueness
    const exists = await Faction.findOne({ guildId, $or: [{ name }, { tag: tag.toUpperCase() }] });
    if (exists) {
      return { faction: null, error: `❌ A faction named **${exists.name}** or with tag **[${exists.tag}]** already exists.` };
    }

    char.currency.gold -= FACTION_CREATE_COST.gold;

    const faction = await Faction.create({
      guildId,
      name,
      tag:         tag.toUpperCase(),
      emoji:       emoji ?? "⚔️",
      description: description ?? "",
      leaderId:    userId,
      members:     [{ userId, rank: "leader", contribution: 0, joinedAt: new Date() }],
    });

    char.factionId = faction._id;
    await char.save();

    return { faction, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // JOIN
  // ───────────────────────────────────────────────────────────────────────────

  static async join(faction, char) {
    if (char.factionId) {
      return { ok: false, error: "❌ You are already in a faction." };
    }
    if (faction.members.length >= faction.maxMembers) {
      return { ok: false, error: `❌ **${faction.name}** is full (${faction.members.length}/${faction.maxMembers}).` };
    }
    if (faction.warStatus === "in_war") {
      return { ok: false, error: "❌ Cannot join a faction that is currently at war." };
    }

    faction.members.push({ userId: char.userId, rank: "member", contribution: 0 });
    char.factionId = faction._id;

    await Promise.all([faction.save(), char.save()]);
    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LEAVE
  // ───────────────────────────────────────────────────────────────────────────

  static async leave(faction, char) {
    const member = faction.getMember(char.userId);
    if (!member) return { ok: false, error: "❌ You are not in this faction." };

    if (member.rank === "leader" && faction.members.length > 1) {
      return { ok: false, error: "❌ Transfer leadership before leaving." };
    }

    faction.members = faction.members.filter(m => m.userId !== char.userId);
    char.factionId  = null;

    // Disband if last member
    if (faction.members.length === 0) {
      await faction.deleteOne();
      await char.save();
      return { ok: true, disbanded: true, error: null };
    }

    // Auto-promote an officer to leader if leader left somehow
    if (faction.leaderId === char.userId) {
      const newLeader     = faction.members.find(m => m.rank === "officer") ?? faction.members[0];
      newLeader.rank      = "leader";
      faction.leaderId    = newLeader.userId;
    }

    await Promise.all([faction.save(), char.save()]);
    return { ok: true, disbanded: false, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // KICK
  // ───────────────────────────────────────────────────────────────────────────

  static async kick(faction, kickerUserId, targetUserId) {
    if (!faction.isLeaderOrOfficer(kickerUserId)) {
      return { ok: false, error: "❌ Only leaders and officers can kick members." };
    }
    const kicker = faction.getMember(kickerUserId);
    const target = faction.getMember(targetUserId);

    if (!target) return { ok: false, error: "❌ That player is not in your faction." };
    if (target.rank === "leader") return { ok: false, error: "❌ Cannot kick the leader." };
    if (kicker.rank === "officer" && target.rank === "officer") {
      return { ok: false, error: "❌ Officers cannot kick other officers." };
    }

    faction.members = faction.members.filter(m => m.userId !== targetUserId);

    const targetChar = await Character.findOne({ userId: targetUserId, guildId: faction.guildId });
    if (targetChar) { targetChar.factionId = null; await targetChar.save(); }

    await faction.save();
    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROMOTE / DEMOTE
  // ───────────────────────────────────────────────────────────────────────────

  static async setRank(faction, leaderUserId, targetUserId, newRank) {
    const leader = faction.getMember(leaderUserId);
    if (!leader || leader.rank !== "leader") {
      return { ok: false, error: "❌ Only the faction leader can change ranks." };
    }

    const target = faction.getMember(targetUserId);
    if (!target) return { ok: false, error: "❌ Player not in faction." };
    if (targetUserId === leaderUserId) return { ok: false, error: "❌ Can't change your own rank." };
    if (!["officer","elite","member"].includes(newRank)) {
      return { ok: false, error: "❌ Invalid rank. Use: officer / elite / member" };
    }

    // Transfer leadership
    if (newRank === "leader") {
      leader.rank        = "member";
      target.rank        = "leader";
      faction.leaderId   = targetUserId;
    } else {
      target.rank = newRank;
    }

    await faction.save();
    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DONATE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Player donates gold to faction treasury. Earns faction tokens in return.
   * @param {Faction}   faction
   * @param {Character} char
   * @param {number}    amount  — gold to donate
   */
  static async donate(faction, char, amount) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      return { ok: false, error: "❌ Invalid donation amount." };
    }
    if (char.currency.gold < amount) {
      return { ok: false, error: `❌ Not enough gold (have ${char.currency.gold.toLocaleString()}, donating ${amount.toLocaleString()}).` };
    }

    const tokensEarned = Math.floor(amount / 100); // 1 token per 100 gold

    char.currency.gold       -= amount;
    char.currency.factionTokens += tokensEarned;
    faction.factionGold      += amount;
    faction.factionTokens    += tokensEarned;

    const member = faction.getMember(char.userId);
    if (member) member.contribution += amount;

    await Promise.all([faction.save(), char.save()]);
    return { ok: true, tokensEarned, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UPGRADE HALL
  // ───────────────────────────────────────────────────────────────────────────

  static async upgradeHall(faction, officerUserId, upgradeId) {
    if (!faction.isLeaderOrOfficer(officerUserId)) {
      return { ok: false, error: "❌ Only leaders and officers can upgrade the Faction Hall." };
    }

    const upgDef = HALL_UPGRADES[upgradeId];
    if (!upgDef) return { ok: false, error: "❌ Unknown upgrade." };

    let hallUpg = faction.hallUpgrades.find(u => u.upgradeId === upgradeId);
    const currentLevel = hallUpg?.level ?? 0;

    if (currentLevel >= upgDef.maxLevel) {
      return { ok: false, error: `❌ **${upgDef.name}** is already at max level (${upgDef.maxLevel}).` };
    }

    const cost = getUpgradeCost(upgradeId, currentLevel);
    if (faction.factionGold < cost.gold || faction.factionTokens < cost.tokens) {
      return {
        ok: false,
        error: `❌ Insufficient resources. Need **${cost.gold.toLocaleString()}** 🪙 gold and **${cost.tokens}** faction tokens.`,
      };
    }

    faction.factionGold   -= cost.gold;
    faction.factionTokens -= cost.tokens;

    if (hallUpg) {
      hallUpg.level++;
    } else {
      faction.hallUpgrades.push({ upgradeId, name: upgDef.name, level: 1, effect: upgDef.effectPerLevel });
      hallUpg = faction.hallUpgrades[faction.hallUpgrades.length - 1];
    }

    // Apply immediate effects
    if (upgradeId === "barracks") {
      faction.maxMembers = 30 + hallUpg.level * 2;
    }

    await faction.save();
    return { ok: true, newLevel: hallUpg.level, cost, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DAILY INCOME
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called by a daily cron job. Distributes territory income to faction treasury.
   * @param {Faction} faction
   */
  static async distributeDailyIncome(faction) {
    let goldIncome  = 0;
    let gemIncome   = 0;
    let tokenIncome = 0;

    // Territory income
    for (const terr of faction.territories) {
      const def = TERRITORIES[terr.territoryId];
      if (!def) continue;
      switch (def.bonusType) {
        case "gold_income":   goldIncome  += def.bonusValue; break;
        case "gem_income":    gemIncome   += def.bonusValue; break;
        case "token_income":  tokenIncome += def.bonusValue; break;
      }
    }

    // Vault upgrade bonus
    const vaultLevel  = faction.getUpgradeLevel("vault");
    goldIncome       += vaultLevel * 500;

    faction.factionGold   += goldIncome;
    faction.factionTokens += tokenIncome;

    await faction.save();

    // Distribute gems to all members
    if (gemIncome > 0) {
      const gemPerMember = Math.floor(gemIncome / Math.max(1, faction.members.length));
      if (gemPerMember > 0) {
        const chars = await Character.find({
          userId: { $in: faction.members.map(m => m.userId) },
          guildId: faction.guildId,
        });
        for (const char of chars) {
          char.currency.gems += gemPerMember;
          await char.save();
        }
      }
    }

    return { goldIncome, gemIncome, tokenIncome };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET ACTIVE BUFFS for a character based on their faction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns a map of active buff types → values for a character's faction.
   * Used by CombatEngine and DungeonEngine.
   * @param {Faction} faction
   * @returns {object}
   */
  static getFactionBuffs(faction) {
    if (!faction) return {};

    const buffs = {
      atk_bonus:       0,
      def_bonus:       0,
      xp_bonus:        0,
      loot_bonus:      0,
      boss_dmg:        0,
      skill_cd_reduce: 0,
      stamina_reduce:  0,
      shop_discount:   0,
      war_power:       0,
    };

    for (const terr of faction.territories) {
      const def = TERRITORIES[terr.territoryId];
      if (!def) continue;
      if (buffs.hasOwnProperty(def.bonusType)) {
        buffs[def.bonusType] += def.bonusValue;
      }
    }

    // War room gives +2% war stats per level
    const warRoomLevel = faction.getUpgradeLevel("war_room");
    buffs.war_power   += warRoomLevel * 0.02;

    // Forge gives crafting discount (handled by crafting engine)
    buffs.craft_discount = faction.getUpgradeLevel("forge") * 0.05;

    // Summoning circle reduces gacha cost
    buffs.gacha_discount = faction.getUpgradeLevel("summoning_circle") * 10;

    // Dungeon portal improves loot
    buffs.dungeon_loot_tier = faction.getUpgradeLevel("dungeon_portal");

    return buffs;
  }
}

module.exports = FactionEngine;
