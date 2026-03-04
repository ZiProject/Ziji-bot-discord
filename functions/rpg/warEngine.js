// functions/rpg/warEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// WarEngine — all active war logic:
//   declareWar, assembleRoster, startRelay, resolveRelayRound,
//   attackSiege, resolveWar
// ─────────────────────────────────────────────────────────────────────────────

const Faction    = require("../../models/Faction");
const FactionWar = require("../../models/FactionWar");
const Character  = require("../../models/Character");
const { RELAY_CONFIG, WAR_REWARDS, TERRITORIES, getWarCooldownHours } = require("../../data/factions");

// Combat engine used for relay battles (reuse existing system)
const CombatEngine = require("./combat");

class WarEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // DECLARE WAR
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Leader/officer declares war on another faction.
   * Creates a FactionWar document and sets both factions to "in_war".
   *
   * @param {Faction}  attacker
   * @param {Faction}  defender
   * @param {string}   declaredByUserId
   * @param {string}   targetTerritory   — territory being contested (optional)
   * @param {string}   channelId
   * @returns {{ war: FactionWar|null, error: string|null }}
   */
  static async declareWar(attacker, defender, declaredByUserId, targetTerritory, channelId) {
    // Validation
    if (!attacker.isLeaderOrOfficer(declaredByUserId)) {
      return { war: null, error: "❌ Only leaders and officers can declare war." };
    }
    if (attacker._id.toString() === defender._id.toString()) {
      return { war: null, error: "❌ Cannot declare war on your own faction." };
    }
    if (attacker.warStatus !== "idle") {
      return { war: null, error: `❌ **${attacker.name}** is already involved in a war.` };
    }
    if (defender.warStatus !== "idle") {
      return { war: null, error: `❌ **${defender.name}** is already in a war or on cooldown.` };
    }
    if (attacker.members.length < 3) {
      return { war: null, error: "❌ Need at least 3 members to declare war." };
    }

    // War cooldown check
    if (attacker.warCooldownUntil && new Date() < new Date(attacker.warCooldownUntil)) {
      const ts = Math.floor(new Date(attacker.warCooldownUntil).getTime() / 1000);
      return { war: null, error: `❌ Your faction is on war cooldown until <t:${ts}:R>.` };
    }

    // Validate territory (if specified, must be held by defender)
    if (targetTerritory) {
      const terrDef = TERRITORIES[targetTerritory];
      if (!terrDef) return { war: null, error: "❌ Unknown territory." };
      const defenderHoldsIt = defender.territories.some(t => t.territoryId === targetTerritory);
      const neutralTerritory = !attacker.territories.some(t => t.territoryId === targetTerritory) && !defenderHoldsIt;
      if (!defenderHoldsIt && !neutralTerritory) {
        return { war: null, error: `❌ **${attacker.name}** already controls that territory.` };
      }
    }

    const prepEnds = new Date(Date.now() + RELAY_CONFIG.preparationTime * 60 * 1000);
    const warEnds  = new Date(prepEnds.getTime() + RELAY_CONFIG.rounds * RELAY_CONFIG.roundTimeLimit * 60 * 1000 + 60 * 60 * 1000);

    const war = await FactionWar.create({
      guildId:  attacker.guildId,
      channelId,
      phase:    "preparation",
      alpha: {
        factionId:   attacker._id,
        factionName: attacker.name,
        factionTag:  attacker.tag,
        color:       attacker.color,
        roster:      [],
        score:       0,
        totalDamage: 0,
        targetTerritory: targetTerritory ?? null,
      },
      beta: {
        factionId:   defender._id,
        factionName: defender.name,
        factionTag:  defender.tag,
        color:       defender.color,
        roster:      [],
        score:       0,
        totalDamage: 0,
        targetTerritory: null,
      },
      currentRound:    1,
      totalRounds:     RELAY_CONFIG.rounds,
      siegeTerritory:  targetTerritory ?? null,
      siegeHp:         targetTerritory ? (TERRITORIES[targetTerritory]?.defenseBase ?? 5000) * 2 : 10000,
      siegeMaxHp:      targetTerritory ? (TERRITORIES[targetTerritory]?.defenseBase ?? 5000) * 2 : 10000,
      preparationEnds: prepEnds,
      warEndsAt:       warEnds,
    });

    // Update faction statuses
    attacker.warStatus    = "in_war";
    attacker.currentWarId = war._id;
    defender.warStatus    = "in_war";
    defender.currentWarId = war._id;

    await Promise.all([attacker.save(), defender.save()]);
    return { war, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // JOIN ROSTER
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * A faction member signs up for the relay battle.
   * @param {FactionWar} war
   * @param {Character}  char
   * @param {number}     position  — 1–5 (preferred battle order)
   * @returns {{ ok: boolean, error: string|null }}
   */
  static async joinRoster(war, char, position) {
    if (war.phase !== "preparation") {
      return { ok: false, error: "❌ Roster signup has closed — war has already started." };
    }

    const { team, side } = war.getTeam(char.factionId?.toString());
    if (!team) return { ok: false, error: "❌ Your faction is not in this war." };

    if (team.roster.length >= RELAY_CONFIG.rosterSize) {
      return { ok: false, error: `❌ Roster is full (${RELAY_CONFIG.rosterSize} players max).` };
    }
    if (team.roster.some(p => p.userId === char.userId)) {
      return { ok: false, error: "❌ You are already in the roster." };
    }

    // Normalise position
    const pos = Math.min(Math.max(1, Math.floor(position)), RELAY_CONFIG.rosterSize);

    // Snap HP for the war snapshot
    const maxHp = char.stats.maxHp;
    team.roster.push({
      userId:   char.userId,
      name:     char.name,
      class:    char.class,
      level:    char.level,
      position: pos,
      hp:       maxHp,
      maxHp,
      ready:    true,
    });

    // Sort roster by position
    team.roster.sort((a, b) => a.position - b.position);
    war.markModified(side);
    await war.save();

    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // START RELAY PHASE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Transition from preparation → relay.
   * Both teams need at least 1 player, but we fill missing slots with AI bots.
   * @param {FactionWar} war
   */
  static async startRelay(war) {
    if (war.phase !== "preparation") return { ok: false, error: "Already started." };

    // Fill missing roster slots with AI bots (so rounds always happen)
    for (const side of ["alpha", "beta"]) {
      const team = war[side];
      while (team.roster.length < RELAY_CONFIG.rosterSize) {
        const slot = team.roster.length + 1;
        team.roster.push({
          userId:   `bot_${side}_${slot}`,
          name:     `${team.factionTag} Warrior ${slot}`,
          class:    "warrior",
          level:    1,
          position: slot,
          hp:       100,
          maxHp:    100,
          ready:    true,
        });
      }
    }

    war.phase = "relay";
    war.markModified("alpha");
    war.markModified("beta");
    await war.save();

    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESOLVE RELAY ROUND
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Simulate one relay battle round between two players.
   * Uses actual Character stats for real players, generated stats for bots.
   *
   * @param {FactionWar} war
   * @param {number}     roundNumber
   * @returns {{ battle: RelayBattle, war: FactionWar }}
   */
  static async resolveRelayRound(war, roundNumber) {
    const attackerSide = war.currentAttacker(); // "alpha" | "beta"
    const defenderSide = attackerSide === "alpha" ? "beta" : "alpha";

    const attackerTeam = war[attackerSide];
    const defenderTeam = war[defenderSide];

    // Pick fighters by round order (round 1 = position 1, etc.)
    const attackerPlayer = attackerTeam.roster[(roundNumber - 1) % RELAY_CONFIG.rosterSize];
    const defenderPlayer = defenderTeam.roster[(roundNumber - 1) % RELAY_CONFIG.rosterSize];

    if (!attackerPlayer || !defenderPlayer) {
      return { battle: null, error: "No fighters found for this round." };
    }

    // Load actual Character stats if real player
    const [attackerChar, defenderChar] = await Promise.all([
      attackerPlayer.userId.startsWith("bot_") ? null : Character.findOne({ userId: attackerPlayer.userId, guildId: war.guildId }),
      defenderPlayer.userId.startsWith("bot_") ? null : Character.findOne({ userId: defenderPlayer.userId, guildId: war.guildId }),
    ]);

    const atkStats = attackerChar
      ? WarEngine._buildWarSnapshot(attackerChar, war, attackerSide)
      : WarEngine._buildBotSnapshot(attackerPlayer);

    const defStats = defenderChar
      ? WarEngine._buildWarSnapshot(defenderChar, war, defenderSide)
      : WarEngine._buildBotSnapshot(defenderPlayer);

    // Simulate battle (up to 20 turns)
    const battleLog    = [];
    let atkHp          = atkStats.hp;
    let defHp          = defStats.hp;
    const MAX_TURNS    = 20;
    let turn           = 0;
    let totalAtkDamage = 0;
    let totalDefDamage = 0;

    while (atkHp > 0 && defHp > 0 && turn < MAX_TURNS) {
      turn++;

      // Attacker hits
      const atkDmg = WarEngine._calcDamage(atkStats, defStats);
      defHp        = Math.max(0, defHp - atkDmg);
      totalAtkDamage += atkDmg;
      battleLog.push(`**T${turn}** ${attackerPlayer.name} → ${atkDmg} dmg → ${defenderPlayer.name} (${defHp}/${defStats.hp} HP)`);

      if (defHp <= 0) break;

      // Defender hits back
      const defDmg = WarEngine._calcDamage(defStats, atkStats);
      atkHp        = Math.max(0, atkHp - defDmg);
      totalDefDamage += defDmg;
      battleLog.push(`**T${turn}** ${defenderPlayer.name} → ${defDmg} dmg → ${attackerPlayer.name} (${atkHp}/${atkStats.hp} HP)`);
    }

    // Determine result
    let result, scoreAlpha, scoreBeta;
    if (atkHp > defHp) {
      result = "win";
      scoreAlpha = attackerSide === "alpha" ? RELAY_CONFIG.scoreWin  : RELAY_CONFIG.scoreLoss;
      scoreBeta  = attackerSide === "beta"  ? RELAY_CONFIG.scoreWin  : RELAY_CONFIG.scoreLoss;
    } else if (defHp > atkHp) {
      result = "loss";
      scoreAlpha = attackerSide === "alpha" ? RELAY_CONFIG.scoreLoss : RELAY_CONFIG.scoreWin;
      scoreBeta  = attackerSide === "beta"  ? RELAY_CONFIG.scoreLoss : RELAY_CONFIG.scoreWin;
    } else {
      result = "draw";
      scoreAlpha = RELAY_CONFIG.scoreDraw;
      scoreBeta  = RELAY_CONFIG.scoreDraw;
    }

    // Update war scores
    war.alpha.score      += scoreAlpha;
    war.alpha.totalDamage += (attackerSide === "alpha" ? totalAtkDamage : totalDefDamage);
    war.alphaScore       += scoreAlpha;
    war.beta.score       += scoreBeta;
    war.beta.totalDamage  += (attackerSide === "beta" ? totalAtkDamage : totalDefDamage);
    war.betaScore        += scoreBeta;

    // Record battle
    const battleRecord = {
      roundNumber,
      attackerId:      attackerPlayer.userId,
      attackerName:    attackerPlayer.name,
      defenderId:      defenderPlayer.userId,
      defenderName:    defenderPlayer.name,
      attackerFaction: attackerSide,
      damageDealt:     totalAtkDamage,
      result,
      log:             battleLog.slice(-10), // Keep last 10 lines
      completedAt:     new Date(),
    };

    war.relayBattles.push(battleRecord);
    war.currentBattle = null;

    // Advance round or move to siege phase
    if (roundNumber >= war.totalRounds) {
      if (war.siegeTerritory) {
        war.phase = "siege";
      } else {
        await WarEngine._resolveWar(war);
        return { battle: battleRecord, war, ended: true };
      }
    } else {
      war.currentRound = roundNumber + 1;
    }

    war.markModified("alpha");
    war.markModified("beta");
    await war.save();

    return { battle: battleRecord, war, ended: false };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SIEGE PHASE — attack the contested territory
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * A relay winner's faction members attack the siege target.
   * Called whenever a player uses the "Attack Siege" button.
   *
   * @param {FactionWar} war
   * @param {Character}  char
   * @returns {{ damage: number, log: string, siegeEnded: boolean }}
   */
  static async attackSiege(war, char) {
    if (war.phase !== "siege") {
      return { damage: 0, log: "❌ Not in siege phase.", siegeEnded: false };
    }

    // Only the relay winner (alpha if alphaScore > betaScore) can attack in siege
    const relayWinnerSide = war.alphaScore >= war.betaScore ? "alpha" : "beta";
    const { side } = war.getTeam(char.factionId?.toString());
    if (side !== relayWinnerSide) {
      return { damage: 0, log: "❌ Only the relay battle winner can attack the siege target.", siegeEnded: false };
    }

    if (war.siegeHp <= 0) {
      return { damage: 0, log: "❌ Siege already ended.", siegeEnded: true };
    }

    // Stamina check
    char._regenStamina();
    if (char.stamina < 5) {
      return { damage: 0, log: "❌ Not enough stamina (need 5).", siegeEnded: false };
    }
    char.stamina -= 5;

    // Damage formula: based on ATK + MATK, with faction war buffs
    const atkPow    = char.stats.atk + char.stats.matk;
    const variance  = 0.9 + Math.random() * 0.2;
    const critRoll  = Math.random() < char.stats.crit;
    const critMult  = critRoll ? (1 + char.stats.critDmg) : 1;
    const damage    = Math.floor(atkPow * 2.5 * variance * critMult);

    war.siegeHp = Math.max(0, war.siegeHp - damage);

    // Track individual contribution
    const existing  = war.siegeDamageLog.get(char.userId) ?? 0;
    war.siegeDamageLog.set(char.userId, existing + damage);

    // Score bonus per 1000 siege damage
    const scoreGain = Math.floor(damage / 1000) * RELAY_CONFIG.siegeScorePerK;
    war.awardScore(relayWinnerSide, scoreGain);

    const log = `${critRoll ? "💥 CRIT! " : ""}${char.name} dealt **${damage.toLocaleString()}** damage to the ${war.siegeTerritory}! (${war.siegeHp.toLocaleString()} HP remaining)`;

    await char.save();

    let siegeEnded = false;
    if (war.siegeHp <= 0) {
      siegeEnded = true;
      await WarEngine._resolveWar(war);
    } else {
      await war.save();
    }

    return { damage, log, siegeEnded };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESOLVE WAR
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Finalise the war: distribute rewards, update territories, set cooldowns.
   * @param {FactionWar} war  — mutated in-place then saved
   */
  static async _resolveWar(war) {
    war.phase  = "ended";
    war.active = false;

    const { winner, team: winnerTeam } = war.determineWinner();

    const alphaFaction = await Faction.findById(war.alpha.factionId);
    const betaFaction  = await Faction.findById(war.beta.factionId);

    if (!alphaFaction || !betaFaction) {
      await war.save();
      return { winner: "error" };
    }

    // Determine actual winner/loser factions
    const winnerFaction = winner === "alpha" ? alphaFaction : winner === "beta" ? betaFaction : null;
    const loserFaction  = winner === "alpha" ? betaFaction  : winner === "beta" ? alphaFaction : null;

    const rewards = WAR_REWARDS;

    // ── Apply rewards ─────────────────────────────────────────────────────────
    async function applyRewards(faction, rewardTier) {
      if (!faction) return;
      faction.awardFactionXP(rewardTier.factionXp);
      faction.factionGold += rewardTier.factionGold;

      // Record war result
      const opponentFaction = faction._id.toString() === alphaFaction._id.toString() ? betaFaction : alphaFaction;
      const factionScore    = faction._id.toString() === alphaFaction._id.toString() ? war.alphaScore : war.betaScore;
      const oppScore        = faction._id.toString() === alphaFaction._id.toString() ? war.betaScore  : war.alphaScore;
      faction.warRecord.push({
        opponent:    opponentFaction._id,
        opponentName:opponentFaction.name,
        result:      winner === "draw" ? "draw" : (faction === winnerFaction ? "win" : "loss"),
        score:       factionScore,
        oppScore,
      });

      if (winner !== "draw") {
        if (faction === winnerFaction) faction.warWins++;
        else faction.warLosses++;
      }

      // Member gem rewards
      const memberUserIds = faction.members.map(m => m.userId);
      const chars = await Character.find({ userId: { $in: memberUserIds }, guildId: faction.guildId });
      for (const char of chars) {
        char.currency.gems += rewardTier.memberGems;
        char.currency.factionTokens = (char.currency.factionTokens ?? 0) + rewardTier.memberTokens;
        await char.save();
      }

      // War cooldown
      const cooldownHours = getWarCooldownHours(faction.getUpgradeLevel("war_room"));
      faction.warStatus         = "cooldown";
      faction.currentWarId      = null;
      faction.warCooldownUntil  = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);

      // After cooldown ends they go back to idle — handled by a scheduler
      await faction.save();
    }

    if (winner === "draw") {
      await Promise.all([applyRewards(alphaFaction, rewards.draw), applyRewards(betaFaction, rewards.draw)]);
    } else {
      await Promise.all([applyRewards(winnerFaction, rewards.winner), applyRewards(loserFaction, rewards.loser)]);

      // ── Territory transfer ──────────────────────────────────────────────────
      if (war.siegeTerritory && winnerFaction) {
        const terrId  = war.siegeTerritory;
        const terrDef = TERRITORIES[terrId];
        if (terrDef) {
          // Remove from loser
          if (loserFaction) {
            loserFaction.territories = loserFaction.territories.filter(t => t.territoryId !== terrId);
            await loserFaction.save();
          }
          // Add to winner if not already owned
          const alreadyOwned = winnerFaction.territories.some(t => t.territoryId === terrId);
          if (!alreadyOwned) {
            winnerFaction.territories.push({
              territoryId:  terrId,
              name:         terrDef.name,
              type:         terrDef.type,
              bonusType:    terrDef.bonusType,
              bonusValue:   terrDef.bonusValue,
              defenseScore: 0,
            });
            await winnerFaction.save();
          }
        }
      }

      // MVP reward (top individual siege damage dealer on winner side)
      const winnerSide = winner === "alpha" ? "alpha" : "beta";
      let topDamage    = 0;
      let mvpUserId    = null;
      for (const [uid, dmg] of war.siegeDamageLog.entries()) {
        const side = war.alpha.roster.some(p => p.userId === uid) ? "alpha" : "beta";
        if (side === winnerSide && dmg > topDamage) { topDamage = dmg; mvpUserId = uid; }
      }
      if (mvpUserId) {
        const mvpChar = await Character.findOne({ userId: mvpUserId, guildId: war.guildId });
        if (mvpChar) {
          mvpChar.currency.gems += rewards.mvp.gems;
          mvpChar.currency.factionTokens = (mvpChar.currency.factionTokens ?? 0) + rewards.mvp.tokens;
          await mvpChar.save();
        }
      }
    }

    war.winnerId    = winnerFaction?._id ?? null;
    war.winnerName  = winnerFaction?.name ?? "Draw";
    await war.save();

    return { winner, winnerFaction };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SURRENDER
  // ───────────────────────────────────────────────────────────────────────────

  static async surrender(war, factionId, userId) {
    const faction = await Faction.findById(factionId);
    if (!faction || !faction.isLeaderOrOfficer(userId)) {
      return { ok: false, error: "❌ Only leaders/officers can surrender." };
    }
    const { side } = war.getTeam(factionId.toString());
    if (!side) return { ok: false, error: "❌ Your faction is not in this war." };

    // Force the score so the opponent wins
    if (side === "alpha") { war.alphaScore = 0; war.betaScore = 99; }
    else                  { war.betaScore  = 0; war.alphaScore = 99; }

    await WarEngine._resolveWar(war);
    return { ok: true, error: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /** Build a stats snapshot for a real Character, including faction war buffs */
  static _buildWarSnapshot(char, war, side) {
    const { team } = war.getTeam(char.factionId?.toString() ?? "");
    const warBuff  = 0; // faction war_power buff applied separately via FactionEngine

    return {
      hp:      char.stats.maxHp,
      atk:     Math.floor(char.stats.atk   * (1 + warBuff)),
      matk:    Math.floor(char.stats.matk  * (1 + warBuff)),
      def:     Math.floor(char.stats.def   * (1 + warBuff)),
      mdef:    Math.floor(char.stats.mdef  * (1 + warBuff)),
      spd:     char.stats.spd,
      crit:    char.stats.crit,
      critDmg: char.stats.critDmg,
      level:   char.level,
    };
  }

  /** Generate simple bot stats based on roster entry */
  static _buildBotSnapshot(rosterEntry) {
    const lvl = rosterEntry.level;
    return {
      hp:      100 + lvl * 30,
      atk:     10  + lvl * 3,
      matk:    8   + lvl * 2,
      def:     5   + lvl * 1,
      mdef:    4   + lvl * 1,
      spd:     5   + lvl,
      crit:    0.05,
      critDmg: 0.5,
      level:   lvl,
    };
  }

  /** Simple damage calculation for relay battles */
  static _calcDamage(attacker, defender) {
    const base     = attacker.atk * 1.5 - defender.def * 0.4;
    const variance = 0.85 + Math.random() * 0.3;
    const crit     = Math.random() < attacker.crit ? (1 + attacker.critDmg) : 1;
    return Math.max(1, Math.floor(base * variance * crit));
  }
}

module.exports = WarEngine;
