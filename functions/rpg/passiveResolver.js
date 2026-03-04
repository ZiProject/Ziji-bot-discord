// functions/rpg/passiveResolver.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads a character's learned skills and computes all passive bonuses
// that are checked DYNAMICALLY during combat (not applied as flat stat changes).
//
// Used by CombatEngine to:
//   - Check spell_echo_chance before casting
//   - Check counter_chance when hit
//   - Check dodge_chance when targeted
//   - Compute low_hp_atk_bonus scaling
//   - Apply lifesteal_on_kill
// ─────────────────────────────────────────────────────────────────────────────

const { getSkill } = require("../../data/skills");

class PassiveResolver {

  /**
   * Build a passive bonus map for a player snapshot (from DungeonRun).
   * Call once per turn, not every hit.
   *
   * @param {object}   playerSnap  — player snapshot from DungeonRun
   * @param {string}   classId
   * @param {{skillId, rank}[]} skills  — from Character.skills
   * @returns {object} passives
   */
  static resolve(playerSnap, classId, skills = []) {
    const passives = {
      spellEchoChance:    0,
      counterChance:      0,
      counterMultiplier:  0.80,
      dodgeChance:        0,
      dodgeCounterMult:   0.60,
      lifestealOnKill:    0,
      lowHpAtkPerTen:     0,   // % ATK per 10% missing HP
      healPowerBonus:     1.0,
      undyingRage:        false,  // at <20% HP: immune to Death
    };

    for (const learned of skills) {
      const skill = getSkill(classId, learned.skillId);
      if (!skill || skill.type !== "passive" || !skill.passive) continue;

      const rank  = learned.rank;
      const { stat, valuePerRank } = skill.passive;
      const total = valuePerRank * rank;

      switch (stat) {
        case "spell_echo_chance":
          passives.spellEchoChance = total;
          if (rank >= 5) passives.spellEchoChance = 0.30;
          break;

        case "counter_chance":
          passives.counterChance = total;
          if (rank >= 3) passives.counterMultiplier = 1.00;
          if (rank >= 4) passives.counterMultiplier = 1.10;
          if (rank >= 5) passives.counterMultiplier = 1.30;
          break;

        case "lifesteal_on_kill":
          passives.lifestealOnKill = total;
          break;

        case "dodge_chance":
          passives.dodgeChance = total;
          if (rank >= 3) passives.dodgeCounterMult = 0.80;
          if (rank >= 4) passives.dodgeCounterMult = 1.00;
          if (rank >= 5) passives.dodgeCounterMult = 1.00; // + bleed
          break;

        case "low_hp_atk_bonus":
          passives.lowHpAtkPerTen = valuePerRank * rank;
          if (rank >= 5) passives.undyingRage = true;
          break;

        case "heal_power":
          passives.healPowerBonus = 1.0 + total;
          break;
      }
    }

    return passives;
  }

  /**
   * Compute the low-HP ATK multiplier for Berserker passive.
   * @param {number} currentHp
   * @param {number} maxHp
   * @param {number} bonusPerTen — from passives.lowHpAtkPerTen
   */
  static lowHpMultiplier(currentHp, maxHp, bonusPerTen) {
    if (!bonusPerTen) return 1.0;
    const missingPct = Math.max(0, 1 - currentHp / maxHp);
    const tenths     = Math.floor(missingPct * 10);
    return 1.0 + bonusPerTen * tenths;
  }

  /**
   * Check if a Spell Echo procs.
   * @param {number} chance
   * @param {function} rand — random number generator (SeededRNG.next)
   */
  static checkSpellEcho(chance, rand) {
    return rand() < chance;
  }

  /**
   * Check if a Counter Strike procs on being hit.
   * @param {number} chance
   * @param {function} rand
   */
  static checkCounter(chance, rand) {
    return rand() < chance;
  }

  /**
   * Check if an Evasion dodge procs.
   * @param {number} chance
   * @param {function} rand
   */
  static checkDodge(chance, rand) {
    return rand() < chance;
  }

  /**
   * Get the active rank of a skill for a character.
   * Returns 0 if not learned.
   * @param {{skillId, rank}[]} skills
   * @param {string} skillId
   */
  static getSkillRank(skills, skillId) {
    return skills.find(s => s.skillId === skillId)?.rank ?? 0;
  }

  /**
   * Compute effective ATK for a player, including Blood Frenzy + low HP bonus.
   * @param {object} player  — player snapshot
   * @param {object} passives — from PassiveResolver.resolve()
   */
  static effectiveAtk(player, passives) {
    let atk = player.atk;

    // Berserk buff
    const berserk = (player.buffs ?? []).find(b => b.type === "berserk");
    if (berserk) atk = Math.floor(atk * (1 + berserk.value));

    // Low HP bonus (Berserker Undying Rage passive)
    if (passives.lowHpAtkPerTen > 0) {
      atk = Math.floor(atk * PassiveResolver.lowHpMultiplier(player.hp, player.maxHp, passives.lowHpAtkPerTen));
    }

    return atk;
  }

  /**
   * Compute effective DEF for a player (Iron Skin, defend buff, etc.)
   * @param {object} player
   */
  static effectiveDef(player) {
    let def = player.def;

    const defending = (player.buffs ?? []).find(b => b.type === "defend");
    if (defending) def = Math.floor(def * 1.50);

    return def;
  }
}

module.exports = PassiveResolver;
