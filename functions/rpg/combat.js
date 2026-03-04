// functions/rpg/combat.js
// ─────────────────────────────────────────────────────────────────────────────
// CombatEngine — handles a single combat turn.
//
//   CombatEngine.resolvePlayerTurn(run, userId, action)
//   CombatEngine.resolveEnemyTurn(run, enemyIdx)
//   CombatEngine.tickStatusEffects(run)
//   CombatEngine.buildCombatEmbed(run, lastLog)
// ─────────────────────────────────────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const SeededRNG = require("./seededRng");

// ─── Elemental Modifier Table ─────────────────────────────────────────────────
// ELEMENTAL_TABLE[attackerElement][defenderElement] → multiplier
const ELEMENTS = ["fire","ice","lightning","earth","wind","water","dark","light","void","none"];

const ELEMENTAL_TABLE = {
  fire:      { fire:1.0, ice:0.5, lightning:1.0, earth:0.75, wind:1.25, water:0.5, dark:1.0, light:0.75, void:1.0, none:1.0 },
  ice:       { fire:1.5, ice:1.0, lightning:0.5, earth:1.0, wind:0.75, water:1.25, dark:0.75, light:1.0, void:1.0, none:1.0 },
  lightning: { fire:1.0, ice:1.5, lightning:1.0, earth:0.5, wind:1.25, water:1.0, dark:0.75, light:0.75, void:1.0, none:1.0 },
  earth:     { fire:1.25, ice:1.0, lightning:1.5, earth:1.0, wind:0.5, water:0.75, dark:1.0, light:0.75, void:1.0, none:1.0 },
  wind:      { fire:0.75, ice:1.25, lightning:0.75, earth:1.5, wind:1.0, water:1.0, dark:1.0, light:1.0, void:0.75, none:1.0 },
  water:     { fire:1.5, ice:0.75, lightning:1.0, earth:1.25, wind:1.0, water:1.0, dark:0.75, light:1.0, void:1.0, none:1.0 },
  dark:      { fire:1.0, ice:1.25, lightning:1.25, earth:1.0, wind:1.0, water:1.25, dark:1.0, light:0.5, void:0.75, none:1.0 },
  light:     { fire:1.25, ice:1.0, lightning:1.25, earth:1.25, wind:1.0, water:1.0, dark:1.5, light:1.0, void:0.75, none:1.0 },
  void:      { fire:1.5, ice:1.5, lightning:1.5, earth:1.5, wind:1.5, water:1.5, dark:1.25, light:1.25, void:1.0, none:1.5 },
  none:      { fire:1.0, ice:1.0, lightning:1.0, earth:1.0, wind:1.0, water:1.0, dark:1.0, light:1.0, void:1.0, none:1.0 },
};

function getElementalMod(attackElem, defElem) {
  return (ELEMENTAL_TABLE[attackElem ?? "none"]?.[defElem ?? "none"]) ?? 1.0;
}

// ─── Status Effect Processors ─────────────────────────────────────────────────
const STATUS_PROCESSORS = {

  burn: (target, effect) => {
    const dmg = Math.floor(target.maxHp * 0.08 * effect.stacks);
    target.hp = Math.max(0, target.hp - dmg);
    return `🔥 **Burn** dealt **${dmg}** damage`;
  },

  poison: (target, effect) => {
    const dmg = Math.floor(target.maxHp * 0.10 * effect.stacks);
    target.hp = Math.max(0, target.hp - dmg);
    return `🟢 **Poison** dealt **${dmg}** damage`;
  },

  bleed: (target, effect) => {
    const dmg = Math.floor(target.maxHp * 0.06 * effect.stacks);
    target.hp = Math.max(0, target.hp - dmg);
    return `🩸 **Bleed** dealt **${dmg}** damage`;
  },

  shock: (target, effect) => {
    return `⚡ **Shock** (${effect.stacks} stack${effect.stacks > 1 ? "s" : ""}) active`;
  },

  regen: (target, effect) => {
    const heal = Math.floor(target.maxHp * 0.08);
    target.hp  = Math.min(target.maxHp, target.hp + heal);
    return `💚 **Regen** restored **${heal}** HP`;
  },
};

// ─── Skill Definitions (inline for now — move to data/skills/ later) ──────────
const SKILLS = {
  // Warrior
  shield_slam:   { name:"Shield Slam",   mpCost:10, dmgType:"physical", multiplier:1.5, elem:"none",  effect:{ type:"stun", chance:0.30, duration:1 } },
  taunt:         { name:"Taunt",         mpCost:15, dmgType:"buff",     effect:{ type:"taunt", duration:2 } },
  iron_skin:     { name:"Iron Skin",     mpCost:0,  dmgType:"passive",  effect:{ type:"def_up", value:0.05 } },
  war_cry:       { name:"War Cry",       mpCost:30, dmgType:"buff",     effect:{ type:"atk_up", value:0.20, duration:3, aoe:true } },
  titans_fury:   { name:"Titan's Fury",  mpCost:80, dmgType:"physical", multiplier:4.0, elem:"none", aoe:true, hpCost:0.03 },

  // Mage
  fireball:      { name:"Fireball",      mpCost:20, dmgType:"magic",    multiplier:1.2, elem:"fire",      effect:{ type:"burn",   chance:0.70, stacks:1, duration:2 } },
  frost_bolt:    { name:"Frost Bolt",    mpCost:18, dmgType:"magic",    multiplier:1.1, elem:"ice",       effect:{ type:"freeze", chance:0.25, duration:1 } },
  arcane_missile:{ name:"Arcane Missile",mpCost:25, dmgType:"magic",    multiplier:0.4, elem:"none", hits:5 },
  singularity:   { name:"Singularity",   mpCost:120,dmgType:"magic",    multiplier:6.0, elem:"void", ignoreResist:0.50 },

  // Rogue
  backstab:      { name:"Backstab",      mpCost:15, dmgType:"physical", multiplier:2.5, elem:"none",  requiresStealth:true, critBonus:0.50 },
  stealth:       { name:"Stealth",       mpCost:20, dmgType:"buff",     effect:{ type:"stealth", duration:1 } },

  // Cleric
  heal:          { name:"Heal",          mpCost:25, dmgType:"heal",     multiplier:2.0, targetsAlly:true },
  holy_light:    { name:"Holy Light",    mpCost:18, dmgType:"magic",    multiplier:1.2, elem:"light", effect:{ type:"undead_bonus", mult:1.5 } },

  // Ranger
  power_shot:    { name:"Power Shot",    mpCost:12, dmgType:"physical", multiplier:1.8, elem:"none" },
  set_trap:      { name:"Set Trap",      mpCost:20, dmgType:"special",  effect:{ type:"trap", dmg:1.0, trigger:"next_turn" } },

  // Berserker
  savage_strike: { name:"Savage Strike", mpCost:5,  dmgType:"physical", multiplier:2.0, elem:"none", selfDmg:0.05 },
  blood_frenzy:  { name:"Blood Frenzy",  mpCost:0,  dmgType:"buff",     effect:{ type:"berserk", atkBonus:0.50, defPenalty:0.30, duration:3 } },

  // Basic enemy skills
  m_strike:      { name:"Strike",        mpCost:0,  dmgType:"physical", multiplier:1.0, elem:"none" },
  m_firebolt:    { name:"Fire Bolt",     mpCost:10, dmgType:"magic",    multiplier:1.0, elem:"fire", effect:{ type:"burn", chance:0.40, stacks:1, duration:2 } },
  m_hex:         { name:"Hex",           mpCost:15, dmgType:"magic",    multiplier:0.5, elem:"dark", effect:{ type:"curse", chance:0.50, duration:2 } },
  m_bite:        { name:"Bite",          mpCost:0,  dmgType:"physical", multiplier:0.9, elem:"none", effect:{ type:"bleed", chance:0.30, stacks:1, duration:3 } },
  m_gnaw:        { name:"Gnaw",          mpCost:0,  dmgType:"physical", multiplier:0.7, elem:"none" },
  m_ground_slam: { name:"Ground Slam",   mpCost:0,  dmgType:"physical", multiplier:1.4, aoe:true, elem:"earth" },
  m_rock_throw:  { name:"Rock Throw",    mpCost:0,  dmgType:"physical", multiplier:1.2, elem:"earth" },
  m_regen:       { name:"Regenerate",    mpCost:0,  dmgType:"buff",     effect:{ type:"regen", duration:3 } },
  m_enrage:      { name:"Enrage",        mpCost:0,  dmgType:"buff",     effect:{ type:"berserk", atkBonus:0.40, defPenalty:0.0, duration:99 }, hpThreshold:0.40 },
  m_war_cry:     { name:"War Cry",       mpCost:0,  dmgType:"buff",     effect:{ type:"atk_up", value:0.30, duration:3, aoe:false } },
  m_shield_bash: { name:"Shield Bash",   mpCost:0,  dmgType:"physical", multiplier:1.1, effect:{ type:"stun", chance:0.20, duration:1 } },
  m_death_bolt:  { name:"Death Bolt",    mpCost:15, dmgType:"magic",    multiplier:1.4, elem:"dark", effect:{ type:"curse", chance:0.50, duration:2 } },
  m_raise_dead:  { name:"Raise Dead",    mpCost:30, dmgType:"special",  effect:{ type:"summon", count:1 } },
  m_curse:       { name:"Curse",         mpCost:10, dmgType:"debuff",   effect:{ type:"curse", chance:0.80, duration:3 } },
  m_dark_nova:   { name:"Dark Nova",     mpCost:40, dmgType:"magic",    multiplier:1.6, elem:"dark", aoe:true },
  m_bone_armor:  { name:"Bone Armor",    mpCost:0,  dmgType:"buff",     effect:{ type:"shield", flat:200 } },
  m_fireball:    { name:"Fireball",      mpCost:20, dmgType:"magic",    multiplier:1.5, elem:"fire", effect:{ type:"burn", chance:0.60, stacks:2, duration:2 } },
  m_flame_breath:{ name:"Flame Breath",  mpCost:25, dmgType:"magic",    multiplier:1.3, elem:"fire", aoe:true, effect:{ type:"burn", chance:0.80, stacks:1, duration:3 } },
  m_ignite:      { name:"Ignite",        mpCost:10, dmgType:"debuff",   effect:{ type:"burn", chance:1.0, stacks:3, duration:4 } },
  m_soul_drain:  { name:"Soul Drain",    mpCost:0,  dmgType:"magic",    multiplier:0.8, elem:"dark", lifesteal:1.0 },
  m_curse_spirit:{ name:"Curse",         mpCost:10, dmgType:"debuff",   effect:{ type:"curse", chance:0.70, duration:3 } },
  m_phase:       { name:"Phase Shift",   mpCost:20, dmgType:"buff",     effect:{ type:"stealth", duration:1 } },
};

class CombatEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // PLAYER TURN
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {DungeonRun} run
   * @param {string}     userId
   * @param {object}     action  — { type: "attack"|"skill"|"item"|"defend"|"flee", skillId?, itemId?, targetIdx? }
   * @returns {{ log: string[], run: DungeonRun, combatOver: boolean, victory: boolean }}
   */
  static async resolvePlayerTurn(run, userId, action) {
    const player  = run.getPlayer(userId);
    const rng     = new SeededRNG(Date.now() + Math.random() * 10000);
    const log     = [];

    if (!player || player.downed) {
      return { log: ["❌ You are downed and cannot act."], run, combatOver: false, victory: false };
    }

    // ── Status checks — can this player act? ────────────────────────────────
    const hasStun   = player.statusEffects.some(e => e.type === "stun");
    const hasFreeze = player.statusEffects.some(e => e.type === "freeze");
    const hasFear   = player.statusEffects.some(e => e.type === "fear") && action.type === "attack";
    const hasPetrify= player.statusEffects.some(e => e.type === "petrify");

    if (hasStun)    { log.push(`💫 **${player.name}** is stunned and cannot act!`); return { log, run, combatOver: false, victory: false }; }
    if (hasFreeze)  { log.push(`❄️ **${player.name}** is frozen and cannot act!`); return { log, run, combatOver: false, victory: false }; }
    if (hasFear)    { log.push(`😱 **${player.name}** is too scared to attack!`); return { log, run, combatOver: false, victory: false }; }
    if (hasPetrify) { log.push(`🪨 **${player.name}** is petrified!`); return { log, run, combatOver: false, victory: false }; }

    // ── Silenced? Can't use skills ───────────────────────────────────────────
    const silenced = player.statusEffects.some(e => e.type === "silence");
    if (silenced && action.type === "skill") {
      log.push(`🔇 **${player.name}** is silenced and cannot use skills!`);
      return { log, run, combatOver: false, victory: false };
    }

    // ── Confused? 30% chance attack ally ────────────────────────────────────
    const confused  = player.statusEffects.some(e => e.type === "confuse");
    let actualTarget = null;
    if (confused && rng.next() < 0.30) {
      const allies = run.alivePlayers().filter(p => p.userId !== userId);
      if (allies.length) {
        actualTarget = allies[Math.floor(rng.next() * allies.length)];
        log.push(`🌀 **${player.name}** is confused and attacks ${actualTarget.name}!`);
      }
    }

    // ── Action resolution ───────────────────────────────────────────────────
    switch (action.type) {

      case "attack": {
        const targetIdx = action.targetIdx ?? 0;
        const enemy = run.currentEnemies[targetIdx];
        if (!enemy || enemy.hp <= 0) { log.push("❌ Invalid target."); break; }

        const target = actualTarget ?? enemy;
        const dmgResult = CombatEngine._calcPhysicalDmg(player, target, "none", 1.0, rng);
        CombatEngine._applyDamage(target, dmgResult, run, targetIdx);
        log.push(`⚔️ **${player.name}** attacks **${enemy.name}** for **${dmgResult.final}** ${dmgResult.crit ? "💥 CRIT " : ""}damage!`);
        CombatEngine._updateCombo(run, userId, 1);
        break;
      }

      case "skill": {
        const skill = SKILLS[action.skillId];
        if (!skill) { log.push("❌ Unknown skill."); break; }

        // MP check
        if (player.mp < skill.mpCost) {
          log.push(`❌ Not enough MP! (Need ${skill.mpCost}, have ${player.mp})`);
          break;
        }
        player.mp -= skill.mpCost;

        const targetIdx  = action.targetIdx ?? 0;
        const skillResult = CombatEngine._resolveSkill(run, player, skill, targetIdx, rng, log);
        CombatEngine._updateCombo(run, userId, skillResult.hits ?? 1);
        break;
      }

      case "defend": {
        player.buffs.push({ type: "defend", duration: 1, value: 0.50 });
        log.push(`🛡️ **${player.name}** takes a defensive stance! Incoming damage reduced by 50% this turn.`);
        break;
      }

      case "item": {
        // Delegate to item handler (stub — expand with ItemEngine)
        log.push(`🧪 **${player.name}** uses item (${action.itemId}).`);
        break;
      }
    }

    // ── Combo bonus ─────────────────────────────────────────────────────────
    const combo = run.comboCounters.get(userId) ?? 0;
    if (combo >= 9)       log.push(`🔥 **COMBO ×9!** Bonus strike for 150% ATK!`);
    else if (combo >= 6)  log.push(`⚡ **COMBO ×6!** Random debuff applied!`);
    else if (combo >= 3)  log.push(`✨ **COMBO ×3!** +20% damage this turn!`);

    // ── Check combat end ─────────────────────────────────────────────────────
    const { victory, defeat } = run.isCombatOver();
    const combatOver = victory || defeat;

    run.updatedAt = new Date();
    await run.save();

    return { log, run, combatOver, victory };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENEMY TURN
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {DungeonRun} run
   * @param {number}     enemyIdx — index in run.currentEnemies
   * @returns {{ log: string[], run: DungeonRun, combatOver: boolean, victory: boolean }}
   */
  static async resolveEnemyTurn(run, enemyIdx) {
    const enemy = run.currentEnemies[enemyIdx];
    const rng   = new SeededRNG(Date.now() + enemyIdx * 31337);
    const log   = [];

    if (!enemy || enemy.hp <= 0) return { log, run, combatOver: false, victory: false };

    // Status checks
    const stunned  = enemy.statusEffects.some(e => e.type === "stun");
    const frozen   = enemy.statusEffects.some(e => e.type === "freeze");
    const petrified= enemy.statusEffects.some(e => e.type === "petrify");

    if (stunned || frozen || petrified) {
      log.push(`💫 **${enemy.name}** cannot act!`);
      return { log, run, combatOver: false, victory: false };
    }

    // ── AI: pick skill based on HP threshold ────────────────────────────────
    const hpPct      = enemy.hp / enemy.maxHp;
    let availSkills  = [...(enemy.skills ?? ["m_strike"])];

    // If enemy has enrage at < 40% HP, force it
    if (hpPct < 0.40 && availSkills.includes("m_enrage")) {
      const hasEnrage = enemy.buffs.some(b => b.type === "berserk");
      if (!hasEnrage) {
        const enrageSkill = SKILLS["m_enrage"];
        const enrageBuff  = enrageSkill.effect;
        enemy.buffs.push({ type: "berserk", duration: 99, value: enrageBuff.atkBonus });
        enemy.atk = Math.floor(enemy.atk * (1 + enrageBuff.atkBonus));
        log.push(`💢 **${enemy.name}** ENRAGES! ATK increased by ${Math.floor(enrageBuff.atkBonus * 100)}%!`);
        return { log, run, combatOver: false, victory: false };
      }
    }

    // Filter to skills enemy can use (basic AI weight: 60% attack, 40% special)
    const useSpecial = availSkills.length > 1 && rng.next() < 0.40;
    let chosenSkillId = "m_strike";
    if (useSpecial) {
      const specials = availSkills.filter(s => s !== "m_strike");
      chosenSkillId  = rng.pick(specials);
    }

    const skill = SKILLS[chosenSkillId] ?? SKILLS["m_strike"];

    // Pick target — if any player has "taunt" buff, target them
    const alivePlayers = run.alivePlayers();
    if (!alivePlayers.length) return { log, run, combatOver: false, victory: false };

    let target = alivePlayers.find(p => p.statusEffects.some(e => e.type === "taunt"))
              ?? rng.pick(alivePlayers);

    // ── Apply skill ──────────────────────────────────────────────────────────
    if (skill.dmgType === "physical") {
      const dmgResult = CombatEngine._calcPhysicalDmg(enemy, target, enemy.element, skill.multiplier, rng);
      CombatEngine._applyDamage(target, dmgResult, run, null, true);
      log.push(`⚔️ **${enemy.name}** uses **${skill.name}** on **${target.name}** for **${dmgResult.final}** ${dmgResult.crit?"💥CRIT ":""}damage!`);
      if (skill.aoe) {
        for (const other of alivePlayers.filter(p => p.userId !== target.userId)) {
          const d2 = CombatEngine._calcPhysicalDmg(enemy, other, enemy.element, skill.multiplier * 0.7, rng);
          CombatEngine._applyDamage(other, d2, run, null, true);
          log.push(`↳ **${other.name}** takes **${d2.final}** splash damage.`);
        }
      }

    } else if (skill.dmgType === "magic") {
      const dmgResult = CombatEngine._calcMagicDmg(enemy, target, skill.elem ?? enemy.element, skill.multiplier, rng);
      CombatEngine._applyDamage(target, dmgResult, run, null, true);
      log.push(`🔮 **${enemy.name}** uses **${skill.name}** on **${target.name}** for **${dmgResult.final}** magic damage!`);

    } else if (skill.dmgType === "debuff" || skill.dmgType === "buff") {
      CombatEngine._applyStatusEffect(
        skill.dmgType === "debuff" ? target : enemy,
        skill.effect,
        rng,
        log,
        `${enemy.name} → ${target.name}`
      );

    } else {
      // Default attack
      const dmgResult = CombatEngine._calcPhysicalDmg(enemy, target, "none", 1.0, rng);
      CombatEngine._applyDamage(target, dmgResult, run, null, true);
      log.push(`👊 **${enemy.name}** attacks **${target.name}** for **${dmgResult.final}** damage!`);
    }

    // Apply skill status effect if exists
    if (skill.effect && skill.dmgType !== "buff" && skill.dmgType !== "debuff") {
      CombatEngine._applyStatusEffect(target, skill.effect, rng, log, enemy.name);
    }

    // Check if any player is downed
    for (const p of run.players) {
      if (p.hp <= 0 && !p.downed) {
        p.downed = true;
        log.push(`💀 **${p.name}** has been defeated!`);
      }
    }

    const { victory, defeat } = run.isCombatOver();
    run.updatedAt = new Date();
    await run.save();

    return { log, run, combatOver: victory || defeat, victory };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TICK STATUS EFFECTS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Run at the START of each combatant's turn.
   * Decrements duration, removes expired effects, applies DoT.
   *
   * @param {object}   target   — player snapshot or enemy snapshot
   * @param {string}   actorId  — for log prefix
   * @returns {string[]} — log lines
   */
  static tickStatusEffects(target, actorId) {
    const log      = [];
    const toRemove = [];

    for (let i = 0; i < target.statusEffects.length; i++) {
      const effect = target.statusEffects[i];
      const processor = STATUS_PROCESSORS[effect.type];
      if (processor) {
        const line = processor(target, effect);
        if (line) log.push(line);
      }
      effect.duration--;
      if (effect.duration <= 0) toRemove.push(i);
    }

    // Remove expired (iterate backwards to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const effect = target.statusEffects.splice(toRemove[i], 1)[0];
      log.push(`✅ **${effect.type}** expired on ${target.name ?? actorId}.`);
    }

    // Tick buffs
    const buffRemove = [];
    for (let i = 0; i < target.buffs.length; i++) {
      target.buffs[i].duration--;
      if (target.buffs[i].duration <= 0) buffRemove.push(i);
    }
    for (let i = buffRemove.length - 1; i >= 0; i--) {
      const buff = target.buffs.splice(buffRemove[i], 1)[0];
      log.push(`✅ **${buff.type}** buff expired on ${target.name ?? actorId}.`);
    }

    return log;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DAMAGE CALCULATORS
  // ───────────────────────────────────────────────────────────────────────────

  static _calcPhysicalDmg(attacker, defender, element, multiplier, rng) {
    const atkStat  = attacker.atk ?? 10;
    const defStat  = defender.def ?? 5;
    const elemMod  = getElementalMod(element, defender.element ?? "none");
    const variance = 0.9 + rng.next() * 0.2;

    // Crit
    const critRoll = rng.next();
    const hasCrit  = critRoll < (attacker.crit ?? 0.05);
    const critMod  = hasCrit ? 1.5 + (attacker.critDmg ?? 0.5) : 1.0;

    // Defend buff
    const defending = (defender.buffs ?? []).some(b => b.type === "defend");
    const defendMod = defending ? 0.5 : 1.0;

    // Combo bonus
    const combo    = 0; // handled at the call site for player
    const comboMod = 1.0;

    let raw = (atkStat * multiplier - defStat * 0.4) * elemMod * critMod * variance * defendMod * comboMod;
    raw     = Math.max(1, Math.floor(raw));

    return { final: raw, crit: hasCrit, elemMod, type: "physical" };
  }

  static _calcMagicDmg(attacker, defender, element, multiplier, rng) {
    const matkStat = attacker.matk ?? attacker.atk ?? 10;
    const mdefStat = defender.mdef ?? defender.def ?? 5;
    const elemMod  = getElementalMod(element, defender.element ?? "none");
    const variance = 0.9 + rng.next() * 0.2;

    const critRoll = rng.next();
    const hasCrit  = critRoll < (attacker.crit ?? 0.05);
    const critMod  = hasCrit ? 1.5 + (attacker.critDmg ?? 0.5) : 1.0;

    let raw = (matkStat * multiplier - mdefStat * 0.3) * elemMod * critMod * variance;
    raw     = Math.max(1, Math.floor(raw));

    return { final: raw, crit: hasCrit, elemMod, type: "magic" };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // APPLY DAMAGE
  // ───────────────────────────────────────────────────────────────────────────

  static _applyDamage(target, dmgResult, run, enemyIdx, isEnemy = false) {
    // Shield absorption
    const shieldBuff = (target.buffs ?? []).find(b => b.type === "shield");
    let dmg = dmgResult.final;
    if (shieldBuff && shieldBuff.flat > 0) {
      const absorbed = Math.min(shieldBuff.flat, dmg);
      shieldBuff.flat -= absorbed;
      dmg -= absorbed;
      if (shieldBuff.flat <= 0) {
        target.buffs = target.buffs.filter(b => b.type !== "shield");
      }
    }

    // Corruption: healing → damage
    const corrupted = (target.statusEffects ?? []).some(e => e.type === "corruption");

    target.hp = Math.max(0, target.hp - dmg);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // APPLY STATUS EFFECT
  // ───────────────────────────────────────────────────────────────────────────

  static _applyStatusEffect(target, effectDef, rng, log, source) {
    if (!effectDef) return;
    const chance = effectDef.chance ?? 1.0;
    if (rng.next() > chance) return;

    const MAX_STACKS = { burn:3, poison:5, bleed:5, shock:2, slow:2, default:1 };
    const existing   = (target.statusEffects ?? []).find(e => e.type === effectDef.type);
    const maxStack   = MAX_STACKS[effectDef.type] ?? MAX_STACKS.default;

    if (existing) {
      existing.stacks   = Math.min(maxStack, existing.stacks + (effectDef.stacks ?? 1));
      existing.duration = Math.max(existing.duration, effectDef.duration ?? 2);
    } else {
      if (!target.statusEffects) target.statusEffects = [];
      target.statusEffects.push({
        type:     effectDef.type,
        stacks:   Math.min(maxStack, effectDef.stacks ?? 1),
        duration: effectDef.duration ?? 2,
        value:    effectDef.value ?? 0,
        sourceId: source,
      });
    }

    const ICONS = { burn:"🔥",poison:"🟢",bleed:"🩸",shock:"⚡",freeze:"❄️",stun:"💫",
                    curse:"💀",slow:"🐢",silence:"🔇",blind:"👁️",taunt:"📢",confuse:"🌀",
                    petrify:"🪨",fear:"😱",corruption:"🦠" };
    log.push(`${ICONS[effectDef.type] ?? "⚠️"} **${effectDef.type}** applied to **${target.name}**!`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SKILL RESOLVER (player side)
  // ───────────────────────────────────────────────────────────────────────────

  static _resolveSkill(run, player, skill, targetIdx, rng, log) {
    const enemy  = run.currentEnemies[targetIdx];
    let hitsLanded = 1;

    if (skill.dmgType === "physical") {
      const multi  = skill.multiplier ?? 1.0;
      const result = CombatEngine._calcPhysicalDmg(player, enemy, skill.elem ?? "none", multi, rng);
      CombatEngine._applyDamage(enemy, result, run, targetIdx);
      log.push(`⚔️ **${player.name}** uses **${skill.name}** on **${enemy.name}** for **${result.final}** ${result.crit?"💥CRIT ":""}damage!`);

    } else if (skill.dmgType === "magic") {
      const hits   = skill.hits ?? 1;
      hitsLanded   = hits;
      let total    = 0;
      for (let h = 0; h < hits; h++) {
        const result = CombatEngine._calcMagicDmg(player, enemy, skill.elem ?? "none", skill.multiplier ?? 1.0, rng);
        CombatEngine._applyDamage(enemy, result, run, targetIdx);
        total += result.final;
      }
      log.push(`🔮 **${player.name}** uses **${skill.name}** → **${total}** magic damage (${hits} hit${hits > 1 ? "s" : ""})!`);

    } else if (skill.dmgType === "heal") {
      const healAmt = Math.floor((player.matk ?? player.atk ?? 10) * (skill.multiplier ?? 1.5));
      const targets = skill.targetsAlly
        ? run.alivePlayers()
        : [player];
      for (const t of targets) {
        const old = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + healAmt);
        log.push(`💚 **${player.name}** heals **${t.name}** for **${t.hp - old}** HP!`);
      }

    } else if (skill.dmgType === "buff") {
      const eff = skill.effect;
      if (eff) {
        const targets = eff.aoe ? run.alivePlayers() : [player];
        for (const t of targets) {
          t.buffs.push({ type: eff.type, duration: eff.duration ?? 2, value: eff.value ?? 0, flat: eff.flat ?? 0 });
        }
        log.push(`✨ **${player.name}** uses **${skill.name}**!`);
      }
    }

    // Apply skill effect to enemy
    if (skill.effect && ["physical","magic"].includes(skill.dmgType)) {
      CombatEngine._applyStatusEffect(enemy, skill.effect, rng, log, player.name);
    }

    // Mark dead enemies
    for (let i = 0; i < run.currentEnemies.length; i++) {
      const e = run.currentEnemies[i];
      if (e.hp <= 0) log.push(`💀 **${e.name}** has been slain!`);
    }

    return { hits: hitsLanded };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMBO COUNTER
  // ───────────────────────────────────────────────────────────────────────────

  static _updateCombo(run, userId, hits) {
    const current = run.comboCounters.get(userId) ?? 0;
    run.comboCounters.set(userId, current + hits);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BUILD EMBED
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build the Discord embed for the current combat state.
   * @param {DungeonRun} run
   * @param {string[]} lastLog  — last turn's log lines
   * @returns {{ embed: EmbedBuilder, rows: ActionRowBuilder[] }}
   */
  static buildCombatEmbed(run, lastLog = []) {
    const config = require("../../data/dungeons").getDungeonConfig(run.tier);
    const embed  = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${config.emoji} ${run.dungeonName} — Floor ${run.currentFloor}/${run.totalFloors}`)
      .setFooter({ text: `Floor type: ${run.floorType.toUpperCase()} • Turn ${run.turnCount} • Actor: ${run.currentActor()}` });

    // ── Enemies field ──────────────────────────────────────────────────────
    const enemyLines = run.currentEnemies.map((e, i) => {
      const hpBar   = CombatEngine._hpBar(e.hp, e.maxHp);
      const effects = e.statusEffects.map(s => `\`${s.type}×${s.stacks}\``).join(" ");
      return `**${i + 1}.** ${e.emoji ?? "👾"} **${e.name}** ${e.isElite ? "⭐" : ""} ${e.isBoss ? "👑" : ""}\n${hpBar} ${effects}`;
    });
    embed.addFields({ name: "⚔️ Enemies", value: enemyLines.join("\n\n") || "None", inline: false });

    // ── Players field ──────────────────────────────────────────────────────
    const playerLines = run.players.map(p => {
      const hpBar   = CombatEngine._hpBar(p.hp, p.maxHp, 10);
      const mpBar   = CombatEngine._mpBar(p.mp, p.maxMp, 8);
      const effects = p.statusEffects.map(s => `\`${s.type}\``).join(" ");
      const buffs   = p.buffs.map(b => `\`+${b.type}\``).join(" ");
      const status  = p.downed ? "💀 DOWNED" : p.escaped ? "🏃 FLED" : "✅";
      return `${status} **${p.name}** *(${p.class})*\n❤️ ${hpBar} ${p.hp}/${p.maxHp}\n💙 ${mpBar} ${p.mp}/${p.maxMp}\n${effects} ${buffs}`;
    });
    embed.addFields({ name: "👥 Party", value: playerLines.join("\n\n"), inline: false });

    // ── Combat log ─────────────────────────────────────────────────────────
    if (lastLog.length) {
      embed.addFields({
        name: "📜 Last Turn",
        value: lastLog.slice(-6).join("\n").substring(0, 1024),
        inline: false,
      });
    }

    // ── Buttons ────────────────────────────────────────────────────────────
    const rows = [];

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("B_RPG_ATTACK").setLabel("⚔️ Attack").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("B_RPG_SKILL").setLabel("✨ Skill").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("B_RPG_ITEM").setLabel("🧪 Item").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("B_RPG_DEFEND").setLabel("🛡️ Defend").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("B_RPG_FLEE").setLabel("🏃 Flee").setStyle(ButtonStyle.Secondary),
    );
    rows.push(row1);

    return { embed, rows };
  }

  // ─── UI Helpers ─────────────────────────────────────────────────────────────

  static _hpBar(current, max, length = 12) {
    const ratio  = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * length);
    const color  = ratio > 0.5 ? "🟩" : ratio > 0.25 ? "🟨" : "🟥";
    return color.repeat(filled) + "⬛".repeat(length - filled);
  }

  static _mpBar(current, max, length = 8) {
    const ratio  = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * length);
    return "🟦".repeat(filled) + "⬛".repeat(length - filled);
  }
}

module.exports = { CombatEngine, SKILLS, getElementalMod };
