// data/skills/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Complete skill tree for all 10 classes.
// Each class has 3 branches (A = Core, B = Mastery, C = Ultimate).
// Branch C ultimate requires: Level 30 + 5 SP spent in Branch B.
//
// Skill fields:
//   id, name, emoji, branch (A|B|C), type (active|passive|buff|ultimate)
//   dmgType, element, multiplier, hits, mpCost, cooldown (turns),
//   rankScaling: [rank1desc, rank2desc, rank3desc, rank4desc, rank5desc]
//   requires: skillId | null  (prerequisite)
//   effect: { type, chance, stacks, duration, value, aoe }
//   passive: { stat, valuePerRank }  — for passive skills
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_TREES = {

  // ══════════════════════════════════════════════════════════════════════════
  warrior: {
    // ── Branch A — Core ──────────────────────────────────────────────────
    shield_slam: {
      id: "shield_slam", name: "Shield Slam", emoji: "🛡️",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 10, cooldown: 2, multiplier: 1.5, requires: null,
      effect: { type: "stun", chance: 0.30, duration: 1 },
      rankScaling: [
        "150% ATK. 30% Stun chance.",
        "170% ATK. 35% Stun chance. -1 CD.",
        "190% ATK. 40% Stun chance.",
        "210% ATK. 45% Stun. Target DEF -10% for 2t.",
        "240% ATK. 50% Stun. Target DEF -20% for 2t.",
      ],
    },
    taunt: {
      id: "taunt", name: "Taunt", emoji: "📢",
      branch: "A", type: "active", dmgType: "buff", element: "none",
      mpCost: 15, cooldown: 3, requires: null,
      effect: { type: "taunt", duration: 2, aoe: true },
      rankScaling: [
        "Force all enemies to target you for 2 turns.",
        "2 turns + take 10% less damage while taunting.",
        "3 turns + 10% less damage.",
        "3 turns + 15% less damage.",
        "4 turns + 20% less damage. Taunt now heals 5% HP/turn.",
      ],
    },
    iron_skin: {
      id: "iron_skin", name: "Iron Skin", emoji: "🪨",
      branch: "A", type: "passive", requires: "shield_slam",
      passive: { stat: "def", valuePerRank: 0.05 },
      rankScaling: [
        "+5% DEF permanently.",
        "+10% DEF permanently.",
        "+15% DEF permanently.",
        "+20% DEF permanently.",
        "+25% DEF. Also gain +5% MDEF.",
      ],
    },
    endure: {
      id: "endure", name: "Endure", emoji: "💪",
      branch: "A", type: "active", dmgType: "buff", element: "none",
      mpCost: 20, cooldown: 4, requires: "taunt",
      effect: { type: "damage_reduction", value: 0.60, duration: 1 },
      rankScaling: [
        "Reduce all incoming damage by 60% for 1 turn.",
        "70% reduction for 1 turn.",
        "70% reduction for 2 turns.",
        "75% reduction for 2 turns.",
        "80% reduction for 2 turns. Cannot be reduced below 1 HP this turn.",
      ],
    },
    // ── Branch B — Mastery ────────────────────────────────────────────────
    war_cry: {
      id: "war_cry", name: "War Cry", emoji: "📯",
      branch: "B", type: "active", dmgType: "buff", element: "none",
      mpCost: 30, cooldown: 4, requires: null,
      effect: { type: "atk_up", value: 0.20, duration: 3, aoe: true },
      rankScaling: [
        "Party ATK +20% for 3 turns.",
        "Party ATK +25% for 3 turns.",
        "Party ATK +30% for 3 turns. Also +10% SPD.",
        "Party ATK +35% for 4 turns. +10% SPD.",
        "Party ATK +40% for 4 turns. +15% SPD. Grants 1 Combo stack.",
      ],
    },
    counter_strike: {
      id: "counter_strike", name: "Counter Strike", emoji: "🔄",
      branch: "B", type: "passive", requires: "war_cry",
      passive: { stat: "counter_chance", valuePerRank: 0.06 },
      rankScaling: [
        "30% chance to auto-counter physical hits for 80% ATK.",
        "36% chance to counter for 90% ATK.",
        "42% chance to counter for 100% ATK.",
        "48% chance to counter for 110% ATK.",
        "55% chance to counter for 130% ATK. Counter can crit.",
      ],
    },
    bloodlust: {
      id: "bloodlust", name: "Bloodlust", emoji: "🩸",
      branch: "B", type: "passive", requires: "war_cry",
      passive: { stat: "lifesteal_on_kill", valuePerRank: 0.05 },
      rankScaling: [
        "Heal 5% max HP on kill.",
        "Heal 8% max HP on kill.",
        "Heal 10% max HP on kill.",
        "Heal 12% max HP on kill. Also restore 5% MP.",
        "Heal 15% max HP on kill. Restore 8% MP. Next attack after kill deals +20% dmg.",
      ],
    },
    // ── Branch C — Ultimate ───────────────────────────────────────────────
    titans_fury: {
      id: "titans_fury", name: "Titan's Fury", emoji: "⚡",
      branch: "C", type: "ultimate", dmgType: "physical", element: "none",
      mpCost: 80, cooldown: 8, multiplier: 4.0, aoe: true, hpCost: 0.03,
      requires: "bloodlust",
      rankScaling: [
        "400% ATK to all enemies. Costs 3% HP. CD 8.",
        "450% ATK to all. Costs 3% HP. CD 8.",
        "500% ATK. Costs 2% HP. CD 7.",
        "550% ATK. Costs 2% HP. 50% Stun chance on all. CD 7.",
        "600% ATK. Costs 1% HP. 60% Stun all. CD 6. Ignore 20% DEF.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  mage: {
    fireball: {
      id: "fireball", name: "Fireball", emoji: "🔥",
      branch: "A", type: "active", dmgType: "magic", element: "fire",
      mpCost: 20, cooldown: 1, multiplier: 1.2, requires: null,
      effect: { type: "burn", chance: 0.70, stacks: 1, duration: 2 },
      rankScaling: [
        "120% MATK fire. 70% Burn (1 stack, 2t).",
        "140% MATK. 75% Burn (1 stack, 2t).",
        "160% MATK. 80% Burn (2 stacks, 2t).",
        "180% MATK. 85% Burn (2 stacks, 3t).",
        "200% MATK. 90% Burn (3 stacks, 3t). AoE splash 50% to adjacent.",
      ],
    },
    frost_bolt: {
      id: "frost_bolt", name: "Frost Bolt", emoji: "❄️",
      branch: "A", type: "active", dmgType: "magic", element: "ice",
      mpCost: 18, cooldown: 1, multiplier: 1.1, requires: null,
      effect: { type: "freeze", chance: 0.25, duration: 1 },
      rankScaling: [
        "110% MATK ice. 25% Freeze 1t.",
        "130% MATK. 30% Freeze 1t. Slow 1t on any miss.",
        "150% MATK. 35% Freeze. Slow always.",
        "170% MATK. 40% Freeze 2t.",
        "190% MATK. 50% Freeze 2t. Frozen targets take +30% damage.",
      ],
    },
    arcane_missile: {
      id: "arcane_missile", name: "Arcane Missile", emoji: "✨",
      branch: "A", type: "active", dmgType: "magic", element: "none",
      mpCost: 25, cooldown: 2, multiplier: 0.4, hits: 5, requires: "fireball",
      rankScaling: [
        "5 hits × 40% MATK. Random element each hit.",
        "5 hits × 50% MATK.",
        "6 hits × 50% MATK.",
        "6 hits × 60% MATK.",
        "8 hits × 60% MATK. Each hit can crit independently.",
      ],
    },
    mana_shield: {
      id: "mana_shield", name: "Mana Shield", emoji: "🔵",
      branch: "A", type: "active", dmgType: "buff", element: "none",
      mpCost: 0, cooldown: 3, requires: "frost_bolt",
      effect: { type: "mana_shield", duration: 2 },
      rankScaling: [
        "Absorb damage using MP (1 dmg = 1.5 MP). 2 turns.",
        "1 dmg = 1.3 MP. 2 turns.",
        "1 dmg = 1.2 MP. 3 turns.",
        "1 dmg = 1.0 MP. 3 turns. Reflect 10% magic on block.",
        "1 dmg = 0.8 MP. 3 turns. Reflect 20% magic.",
      ],
    },
    spell_echo: {
      id: "spell_echo", name: "Spell Echo", emoji: "🔊",
      branch: "B", type: "passive", requires: null,
      passive: { stat: "spell_echo_chance", valuePerRank: 0.03 },
      rankScaling: [
        "15% chance to cast any spell twice (2nd cast at 50% power).",
        "18% chance. 2nd cast at 60% power.",
        "21% chance. 2nd cast at 70% power.",
        "24% chance. 2nd cast at 80% power.",
        "30% chance. 2nd cast at 100% power. Both casts can crit.",
      ],
    },
    overload: {
      id: "overload", name: "Overload", emoji: "⚡",
      branch: "B", type: "active", dmgType: "buff", element: "none",
      mpCost: 0, cooldown: 3, requires: "spell_echo",
      effect: { type: "empower", duration: 1 },
      rankScaling: [
        "Next spell +80% power. Costs 2× MP.",
        "Next spell +90% power. Costs 1.8× MP.",
        "Next spell +100% power. Costs 1.6× MP.",
        "Next 2 spells +100% power. Costs 1.5× MP each.",
        "Next 2 spells +120% power. Costs 1.3× MP. If both kill: refund MP.",
      ],
    },
    mana_vortex: {
      id: "mana_vortex", name: "Mana Vortex", emoji: "🌀",
      branch: "B", type: "active", dmgType: "magic", element: "none",
      mpCost: 30, cooldown: 4, requires: "spell_echo",
      rankScaling: [
        "Drain 20% enemy MP. Gain half as HP.",
        "Drain 25% enemy MP. Gain 60% as HP.",
        "Drain 30% enemy MP. Gain as HP. Also deal 50% MATK damage.",
        "Drain 35% enemy MP. Gain as HP. Deal 80% MATK.",
        "Drain 40% enemy MP. Gain as HP. Deal 100% MATK. AoE drain 15%.",
      ],
    },
    singularity: {
      id: "singularity", name: "Singularity", emoji: "🕳️",
      branch: "C", type: "ultimate", dmgType: "magic", element: "void",
      mpCost: 120, cooldown: 10, multiplier: 6.0, ignoreResist: 0.50,
      requires: "mana_vortex",
      rankScaling: [
        "600% MATK void. Ignore 50% resistance. CD 10.",
        "700% MATK void. Ignore 55%. CD 10.",
        "800% MATK void. Ignore 60%. CD 9.",
        "900% MATK void. Ignore 65%. Silence all enemies 2t. CD 9.",
        "1000% MATK void. Ignore 70%. Silence 2t. Reduces CD by 3 on kill. CD 8.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  rogue: {
    backstab: {
      id: "backstab", name: "Backstab", emoji: "🗡️",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 15, cooldown: 2, multiplier: 2.5, requiresStealth: true,
      requires: null,
      effect: { type: "crit_bonus", value: 0.50 },
      rankScaling: [
        "250% ATK. +50% crit dmg. Requires Stealth.",
        "280% ATK. +60% crit dmg. Stealth not required (50% bonus if in stealth).",
        "310% ATK. +70% crit dmg. Apply Bleed on hit.",
        "340% ATK. +80% crit dmg. Bleed 2 stacks.",
        "400% ATK. +100% crit dmg. Bleed 3 stacks. Always crits from stealth.",
      ],
    },
    stealth: {
      id: "stealth", name: "Stealth", emoji: "👤",
      branch: "A", type: "active", dmgType: "buff", element: "none",
      mpCost: 20, cooldown: 4, requires: null,
      effect: { type: "stealth", duration: 1 },
      rankScaling: [
        "Enter stealth: dodge next attack 100%, +30% crit rate.",
        "Stealth persists 2 turns before attacking.",
        "2 turns. Dodge persists after attacking. +40% crit.",
        "2 turns. Attack from stealth: +50% crit. Reapply Stealth after crit kill.",
        "3 turns. Next attack from stealth always crits. Invisibility (cannot be targeted).",
      ],
    },
    shadow_step: {
      id: "shadow_step", name: "Shadow Step", emoji: "💨",
      branch: "A", type: "active", dmgType: "physical", element: "dark",
      mpCost: 12, cooldown: 2, multiplier: 1.2, requires: "stealth",
      effect: { type: "blind", chance: 0.40, duration: 1 },
      rankScaling: [
        "Teleport behind enemy. 120% ATK. 40% Blind.",
        "140% ATK. 50% Blind. Resets Stealth CD if it crits.",
        "160% ATK. 55% Blind 2t.",
        "180% ATK. 60% Blind 2t. Move to back of turn order (act again sooner).",
        "200% ATK. 70% Blind 2t. Gain Stealth after use.",
      ],
    },
    poison_blade: {
      id: "poison_blade", name: "Poison Blade", emoji: "☠️",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 10, cooldown: 1, multiplier: 1.0, requires: "backstab",
      effect: { type: "poison", chance: 0.90, stacks: 2, duration: 3 },
      rankScaling: [
        "100% ATK. 90% chance Poison ×2 (3t).",
        "110% ATK. Poison ×3 (3t).",
        "120% ATK. Poison ×3 (4t). Also -10% DEF.",
        "130% ATK. Poison ×4 (4t). -15% DEF.",
        "150% ATK. Poison ×5 (5t). -20% DEF. Poison also reduces healing by 50%.",
      ],
    },
    evasion: {
      id: "evasion", name: "Evasion", emoji: "🌬️",
      branch: "B", type: "passive", requires: null,
      passive: { stat: "dodge_chance", valuePerRank: 0.04 },
      rankScaling: [
        "+4% dodge chance permanently.",
        "+8% dodge chance.",
        "+12% dodge. Counter with 60% ATK on dodge.",
        "+16% dodge. Counter for 80% ATK.",
        "+20% dodge. Counter for 100% ATK. Counter can apply Bleed.",
      ],
    },
    exploit_weakness: {
      id: "exploit_weakness", name: "Exploit Weakness", emoji: "🎯",
      branch: "B", type: "passive", requires: "evasion",
      passive: { stat: "crit_damage", valuePerRank: 0.10 },
      rankScaling: [
        "+10% crit dmg permanently.",
        "+20% crit dmg.",
        "+30% crit dmg. Crits ignore 10% DEF.",
        "+40% crit dmg. Crits ignore 20% DEF.",
        "+50% crit dmg. Crits ignore 30% DEF. On crit: 30% SPD up 2t.",
      ],
    },
    smoke_bomb: {
      id: "smoke_bomb", name: "Smoke Bomb", emoji: "💣",
      branch: "B", type: "active", dmgType: "debuff", element: "none",
      mpCost: 25, cooldown: 5, requires: "evasion",
      effect: { type: "blind", chance: 1.0, duration: 2, aoe: true },
      rankScaling: [
        "Blind all enemies 2 turns. Enter stealth.",
        "Blind 2t. Stealth. All enemies -20% ATK.",
        "Blind 3t. Stealth. -25% ATK.",
        "Blind 3t. Stealth. -30% ATK. Enemies confused 50% chance.",
        "Blind 3t. Stealth. -35% ATK. All enemies confused. CD -1.",
      ],
    },
    death_mark: {
      id: "death_mark", name: "Death Mark", emoji: "💀",
      branch: "C", type: "ultimate", dmgType: "physical", element: "dark",
      mpCost: 70, cooldown: 7, multiplier: 5.0, requires: "smoke_bomb",
      rankScaling: [
        "500% ATK dark. Target receives +50% damage from all sources 3t. CD 7.",
        "550% ATK. +60% received dmg 3t. CD 7.",
        "600% ATK. +70% received dmg 4t. CD 6.",
        "650% ATK. +80% received dmg 4t. Applies 5 Bleed stacks. CD 6.",
        "750% ATK. +100% received dmg 5t. 5 Bleed. Instantly kills target below 10% HP. CD 5.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  cleric: {
    heal: {
      id: "heal", name: "Heal", emoji: "💚",
      branch: "A", type: "active", dmgType: "heal", element: "light",
      mpCost: 25, cooldown: 1, multiplier: 2.0, requires: null,
      rankScaling: [
        "Heal 1 ally for 200% MATK.",
        "Heal for 240% MATK.",
        "Heal for 280% MATK. Remove 1 debuff.",
        "Heal for 320% MATK. Remove 2 debuffs.",
        "Heal for 400% MATK. Remove all debuffs. Cleanse grants Regen 2t.",
      ],
    },
    holy_light: {
      id: "holy_light", name: "Holy Light", emoji: "✨",
      branch: "A", type: "active", dmgType: "magic", element: "light",
      mpCost: 18, cooldown: 1, multiplier: 1.2, requires: null,
      effect: { type: "undead_bonus", mult: 1.5 },
      rankScaling: [
        "120% MATK light. ×1.5 vs undead/dark.",
        "140% MATK. ×1.6 vs undead.",
        "160% MATK. ×1.8 vs undead. 30% Stun vs undead.",
        "180% MATK. ×2.0 vs undead. 40% Stun.",
        "200% MATK. ×2.5 vs undead. 50% Stun. AoE small splash.",
      ],
    },
    divine_shield: {
      id: "divine_shield", name: "Divine Shield", emoji: "🛡️",
      branch: "A", type: "active", dmgType: "buff", element: "light",
      mpCost: 30, cooldown: 4, requires: "heal",
      effect: { type: "shield", flat: 300 },
      rankScaling: [
        "Grant 1 ally a shield absorbing 300 damage.",
        "Shield 400. Can target self or ally.",
        "Shield 500. Reduce magic damage too.",
        "Shield 600. Duration 2 turns if not broken.",
        "Shield 800 for entire party. Duration 2t. Broken shield deals 100% reflected.",
      ],
    },
    resurrection: {
      id: "resurrection", name: "Resurrection", emoji: "✝️",
      branch: "A", type: "active", dmgType: "heal", element: "light",
      mpCost: 60, cooldown: 6, requires: "divine_shield",
      rankScaling: [
        "Revive 1 downed ally at 20% HP.",
        "Revive at 30% HP.",
        "Revive at 40% HP. Also restore 20% MP.",
        "Revive at 50% HP and 30% MP.",
        "Revive at 70% HP and 50% MP. CD -2. Can revive 2 allies simultaneously.",
      ],
    },
    prayer: {
      id: "prayer", name: "Prayer", emoji: "🙏",
      branch: "B", type: "passive", requires: null,
      passive: { stat: "heal_power", valuePerRank: 0.08 },
      rankScaling: [
        "+8% to all healing output.",
        "+16% healing output.",
        "+24% healing. Party members gain +5% HP regen per turn when above 70%.",
        "+32% healing. Regen bonus at 70%.",
        "+40% healing. Regen always active. Overheal converts to temp HP shield.",
      ],
    },
    holy_aura: {
      id: "holy_aura", name: "Holy Aura", emoji: "🌟",
      branch: "B", type: "active", dmgType: "buff", element: "light",
      mpCost: 40, cooldown: 5, requires: "prayer",
      effect: { type: "holy_aura", duration: 3, aoe: true },
      rankScaling: [
        "Party-wide: +15% all stats 3t.",
        "+20% all stats 3t.",
        "+25% all stats 4t. Immunity to 1 debuff.",
        "+30% all stats 4t. Immunity to 2 debuffs.",
        "+35% all stats 5t. Immunity to all debuffs. Regen 8%/t.",
      ],
    },
    smite: {
      id: "smite", name: "Smite", emoji: "⚡",
      branch: "B", type: "active", dmgType: "magic", element: "light",
      mpCost: 22, cooldown: 2, multiplier: 1.8, requires: "prayer",
      effect: { type: "stun", chance: 0.35, duration: 1 },
      rankScaling: [
        "180% MATK light. 35% Stun.",
        "200% MATK. 40% Stun.",
        "220% MATK. 45% Stun. Silence 1t.",
        "250% MATK. 50% Stun. Silence 2t.",
        "280% MATK. 60% Stun 2t. Silence 2t. ×2.0 vs evil/dark.",
      ],
    },
    divine_judgment: {
      id: "divine_judgment", name: "Divine Judgment", emoji: "☀️",
      branch: "C", type: "ultimate", dmgType: "magic", element: "light",
      mpCost: 100, cooldown: 9, multiplier: 7.0, aoe: true, requires: "smite",
      rankScaling: [
        "700% MATK light AoE. Heal party for 30% of damage dealt. CD 9.",
        "800% MATK. Heal 35% of damage. CD 9.",
        "900% MATK. Heal 40%. Dispel all debuffs on party. CD 8.",
        "1000% MATK. Heal 45%. Dispel. Stun all enemies 1t. CD 8.",
        "1200% MATK. Heal 50%. Dispel. Stun 2t. Revive any downed member at 1 HP. CD 7.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  ranger: {
    power_shot: {
      id: "power_shot", name: "Power Shot", emoji: "🏹",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 12, cooldown: 1, multiplier: 1.8, requires: null,
      rankScaling: [
        "180% ATK. Cannot be blocked by taunt.",
        "200% ATK. Ignores 10% DEF.",
        "220% ATK. Ignores 20% DEF.",
        "240% ATK. Ignores 25% DEF. 30% chance Slow.",
        "260% ATK. Ignores 30% DEF. 40% Slow 2t.",
      ],
    },
    set_trap: {
      id: "set_trap", name: "Set Trap", emoji: "🪤",
      branch: "A", type: "active", dmgType: "special", element: "none",
      mpCost: 20, cooldown: 3, requires: null,
      rankScaling: [
        "Lay 1 trap: next enemy who moves triggers it for 100% ATK + Stun.",
        "Trap deals 120% ATK + Stun.",
        "2 traps simultaneously. 140% ATK + Stun.",
        "3 traps. 160% ATK + Stun + Slow.",
        "3 traps. 200% ATK + Stun + Slow 2t. Traps are invisible (enemies can't avoid).",
      ],
    },
    eagle_eye: {
      id: "eagle_eye", name: "Eagle Eye", emoji: "👁️",
      branch: "A", type: "passive", requires: "power_shot",
      passive: { stat: "crit", valuePerRank: 0.03 },
      rankScaling: [
        "+3% crit rate permanently.",
        "+6% crit rate.",
        "+9% crit rate. Crits reduce target SPD -10% 1t.",
        "+12% crit rate. SPD debuff -15% 1t.",
        "+15% crit rate. SPD -20% 2t. Ranged attacks ignore stealth.",
      ],
    },
    multishot: {
      id: "multishot", name: "Multishot", emoji: "↗️",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 30, cooldown: 3, hits: 3, multiplier: 0.7, requires: "set_trap",
      rankScaling: [
        "3 arrows × 70% ATK, random targets.",
        "3 × 80% ATK.",
        "4 × 80% ATK.",
        "4 × 90% ATK. Each arrow can apply Eagle Eye SPD debuff.",
        "5 × 90% ATK. AoE — one arrow guaranteed per enemy.",
      ],
    },
    hunters_mark: {
      id: "hunters_mark", name: "Hunter's Mark", emoji: "🎯",
      branch: "B", type: "active", dmgType: "debuff", element: "none",
      mpCost: 15, cooldown: 3, requires: null,
      effect: { type: "mark", duration: 3 },
      rankScaling: [
        "Mark target: your attacks deal +20% damage to them 3t.",
        "+25% for 3t.",
        "+30% for 4t.",
        "+40% for 4t. Marked target also has -15% DEF.",
        "+50% for 5t. -20% DEF. If target dies while marked: full HP/CD reset.",
      ],
    },
    volley: {
      id: "volley", name: "Volley", emoji: "🌧️",
      branch: "B", type: "active", dmgType: "physical", element: "none",
      mpCost: 45, cooldown: 5, multiplier: 0.6, hits: 8, aoe: true,
      requires: "hunters_mark",
      rankScaling: [
        "8 arrows × 60% ATK spread across all enemies.",
        "8 × 70% ATK AoE.",
        "10 × 70% ATK AoE.",
        "10 × 80% ATK AoE. 20% Bleed per arrow.",
        "12 × 80% ATK AoE. 25% Bleed per arrow. Volley cancels enemy casting.",
      ],
    },
    concussive_shot: {
      id: "concussive_shot", name: "Concussive Shot", emoji: "💥",
      branch: "B", type: "active", dmgType: "physical", element: "none",
      mpCost: 20, cooldown: 3, multiplier: 1.4, requires: "hunters_mark",
      effect: { type: "stun", chance: 0.60, duration: 1 },
      rankScaling: [
        "140% ATK. 60% Stun 1t.",
        "160% ATK. 65% Stun.",
        "180% ATK. 70% Stun. Always Slow if Stun fails.",
        "200% ATK. 75% Stun 2t.",
        "220% ATK. 80% Stun 2t. Interrupts any skill being cast.",
      ],
    },
    piercing_rain: {
      id: "piercing_rain", name: "Piercing Rain", emoji: "🌩️",
      branch: "C", type: "ultimate", dmgType: "physical", element: "lightning",
      mpCost: 90, cooldown: 8, multiplier: 1.2, hits: 10, aoe: true,
      requires: "volley",
      rankScaling: [
        "10 lightning arrows × 120% ATK. Hits all. CD 8.",
        "10 × 130% ATK. CD 8.",
        "12 × 130% ATK. CD 7. Each hit: 40% Shock.",
        "12 × 140% ATK. CD 7. 50% Shock per hit. Shocks stack.",
        "15 × 150% ATK. CD 6. 60% Shock. Final arrow guaranteed Stun main target.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  berserker: {
    savage_strike: {
      id: "savage_strike", name: "Savage Strike", emoji: "🪓",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 5, cooldown: 1, multiplier: 2.0, selfDmg: 0.05, requires: null,
      rankScaling: [
        "200% ATK. Costs 5% HP.",
        "230% ATK. Costs 4% HP.",
        "260% ATK. Costs 3% HP. Lifesteal 20% of damage.",
        "300% ATK. Costs 3% HP. Lifesteal 25%.",
        "350% ATK. Costs 2% HP. Lifesteal 30%. If kills: no HP cost.",
      ],
    },
    blood_frenzy: {
      id: "blood_frenzy", name: "Blood Frenzy", emoji: "💢",
      branch: "A", type: "active", dmgType: "buff", element: "none",
      mpCost: 0, cooldown: 4, requires: null,
      effect: { type: "berserk", atkBonus: 0.50, defPenalty: 0.30, duration: 3 },
      rankScaling: [
        "ATK +50%, DEF -30% for 3t.",
        "ATK +60%, DEF -25% 3t.",
        "ATK +70%, DEF -20% 4t.",
        "ATK +80%, DEF -15% 4t. Also gain 10% lifesteal.",
        "ATK +100%, DEF -10% 5t. 15% lifesteal. Immune to Stun/Fear while active.",
      ],
    },
    war_scream: {
      id: "war_scream", name: "War Scream", emoji: "😤",
      branch: "A", type: "active", dmgType: "debuff", element: "none",
      mpCost: 10, cooldown: 3, requires: "blood_frenzy",
      effect: { type: "fear", chance: 0.70, duration: 1, aoe: true },
      rankScaling: [
        "70% Fear all enemies 1t.",
        "75% Fear 2t.",
        "80% Fear 2t. Also -15% ATK.",
        "85% Fear 2t. -20% ATK.",
        "90% Fear 3t. -25% ATK. Feared enemies take +20% damage.",
      ],
    },
    reckless_charge: {
      id: "reckless_charge", name: "Reckless Charge", emoji: "🔥",
      branch: "A", type: "active", dmgType: "physical", element: "none",
      mpCost: 8, cooldown: 2, multiplier: 2.2, requires: "savage_strike",
      effect: { type: "stun", chance: 0.40, duration: 1 },
      rankScaling: [
        "220% ATK. 40% Stun. Costs 8% current HP.",
        "250% ATK. 45% Stun. 6% HP.",
        "280% ATK. 50% Stun. 4% HP. Knocks target back (skip their next turn on stun).",
        "310% ATK. 55% Stun. 3% HP.",
        "350% ATK. 60% Stun. 2% HP. If used at <30% HP: +50% damage.",
      ],
    },
    berserker_passive: {
      id: "berserker_passive", name: "Undying Rage", emoji: "♾️",
      branch: "B", type: "passive", requires: null,
      passive: { stat: "low_hp_atk_bonus", valuePerRank: 0.05 },
      rankScaling: [
        "+5% ATK per 10% missing HP (max +50%).",
        "+6% ATK per 10% missing HP.",
        "+7% ATK per 10% missing HP. Also +3% DEF per 10% missing HP.",
        "+8% ATK per 10% missing HP. +4% DEF.",
        "+10% ATK per 10% missing HP. +5% DEF. At <20% HP: immune to Death effects.",
      ],
    },
    rampage: {
      id: "rampage", name: "Rampage", emoji: "🌪️",
      branch: "B", type: "active", dmgType: "physical", element: "none",
      mpCost: 0, cooldown: 4, multiplier: 1.5, hits: 3, aoe: true,
      requires: "berserker_passive",
      rankScaling: [
        "3 hits × 150% ATK to random enemies. Lose 10% HP.",
        "3 × 170% ATK. 8% HP cost.",
        "4 × 170% ATK. 6% HP cost.",
        "4 × 190% ATK. 4% HP. Lifesteal 30% of total dmg.",
        "5 × 200% ATK. 2% HP. Lifesteal 40%. Each kill extends duration by 1 hit.",
      ],
    },
    battle_hardened: {
      id: "battle_hardened", name: "Battle Hardened", emoji: "🔩",
      branch: "B", type: "passive", requires: "berserker_passive",
      passive: { stat: "hp_max", valuePerRank: 0.05 },
      rankScaling: [
        "+5% max HP permanently.",
        "+10% max HP.",
        "+15% max HP. Take 10% less true damage.",
        "+20% max HP. 15% less true damage.",
        "+25% max HP. 20% less true damage. 10% chance to survive fatal blow at 1 HP.",
      ],
    },
    berserker_ultimate: {
      id: "berserker_ultimate", name: "Chaos Incarnate", emoji: "💥",
      branch: "C", type: "ultimate", dmgType: "physical", element: "none",
      mpCost: 50, cooldown: 7, multiplier: 3.0, hits: 5, requires: "rampage",
      rankScaling: [
        "5 hits × 300% ATK to 1 target. Gain Berserk free. CD 7.",
        "5 × 320% ATK. CD 7.",
        "6 × 320% ATK. Hits AoE on final strike. CD 6.",
        "6 × 350% ATK. AoE final. Apply Bleed ×3 on all hits. CD 6.",
        "8 × 380% ATK. AoE final. Bleed ×3. If target dies: reset all CDs. CD 5.",
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Additional classes (summoner, paladin, necromancer, elementalist) follow
  // the same pattern — abbreviated here, full data in data/skills/*.json
  // ══════════════════════════════════════════════════════════════════════════

  summoner: {
    summon_familiar: {
      id: "summon_familiar", name: "Summon Familiar", emoji: "👾",
      branch: "A", type: "active", dmgType: "special",
      mpCost: 30, cooldown: 3, requires: null,
      rankScaling: [
        "Summon 1 familiar (20% your ATK/HP). Attacks every turn.",
        "Familiar has 30% your stats.",
        "Familiar 35% stats + can apply Burn.",
        "Familiar 40% stats. 2 familiars max.",
        "Familiar 50% stats. 3 max. Each familiar adds 5% ATK to you.",
      ],
    },
    strengthen_bond: {
      id: "strengthen_bond", name: "Strengthen Bond", emoji: "🔗",
      branch: "A", type: "passive", requires: "summon_familiar",
      rankScaling: [
        "Familiars have +10% HP and ATK.",
        "+20% HP and ATK.",
        "+30% HP and ATK. Familiars inherit 10% your defensive stats.",
        "+40% HP and ATK. 15% defensive inheritance.",
        "+50% HP and ATK. 20% defensive. When familiar dies: explode for 200% their ATK AoE.",
      ],
    },
    soul_link: {
      id: "soul_link", name: "Soul Link", emoji: "💫",
      branch: "B", type: "active", dmgType: "buff",
      mpCost: 35, cooldown: 4, requires: null,
      rankScaling: [
        "Link with familiar: share 20% of damage you take.",
        "Share 30%. When you heal, familiar heals 50%.",
        "Share 40%. Full heal sharing.",
        "Share 50%. Linked familiar +30% ATK.",
        "Share 60%. +40% ATK. Familiar can taunt instead of you.",
      ],
    },
    legion: {
      id: "legion", name: "Legion", emoji: "👥",
      branch: "C", type: "ultimate", dmgType: "special",
      mpCost: 100, cooldown: 9, requires: "soul_link",
      rankScaling: [
        "All familiars attack 1 target simultaneously. CD 9.",
        "All familiars attack + leave target vulnerable (+20% damage) 2t. CD 9.",
        "All familiars attack twice. +20% vulnerable. CD 8.",
        "Triple attack. +30% vulnerable. Summon 2 extra familiars. CD 8.",
        "Triple attack. +40% vulnerable. Max familiars summoned. CD 7.",
      ],
    },
  },

  paladin: {
    divine_shield: {
      id: "paladin_divine_shield", name: "Divine Shield", emoji: "⛨",
      branch: "A", type: "active", dmgType: "buff",
      mpCost: 30, cooldown: 4, requires: null,
      effect: { type: "invincible", duration: 1 },
      rankScaling: [
        "Immune to all damage 1 turn.",
        "Immune 1t. Counter attacker for 80% ATK.",
        "Immune 2t. Counter for 100% ATK.",
        "Immune 2t. Counter 120% ATK. Reflect magic 30%.",
        "Immune 2t. Counter 150% ATK. Reflect 50%. Grant party invincibility 1t.",
      ],
    },
    holy_smite: {
      id: "holy_smite", name: "Holy Smite", emoji: "⚡",
      branch: "A", type: "active", dmgType: "magic", element: "light",
      mpCost: 22, cooldown: 2, multiplier: 1.8, requires: null,
      rankScaling: [
        "180% MATK light. 35% Stun.",
        "200% MATK. 40% Stun. Extra 50% vs demons.",
        "220% MATK. 45% Stun. 80% vs demons.",
        "250% MATK. 50% Stun. ×1.5 vs demons. 20% chance Holy burn (light DoT).",
        "280% MATK. 60% Stun. ×2.0 vs demons. 35% Holy burn.",
      ],
    },
    holy_aura: {
      id: "paladin_aura", name: "Sacred Aura", emoji: "🌟",
      branch: "B", type: "passive", requires: null,
      rankScaling: [
        "Passive: party +5% DEF and MDEF.",
        "+8% DEF and MDEF.",
        "+10% DEF and MDEF. +5% healing received.",
        "+12% DEF/MDEF. +8% healing received.",
        "+15% DEF/MDEF. +10% healing. Immune to Curse and Fear.",
      ],
    },
    retribution: {
      id: "retribution", name: "Retribution", emoji: "☀️",
      branch: "C", type: "ultimate", dmgType: "magic", element: "light",
      mpCost: 100, cooldown: 9, multiplier: 8.0, requires: "holy_aura",
      rankScaling: [
        "800% MATK light. Gain Invincible 1t. CD 9.",
        "900% MATK. Invincible 1t. Heal party 20%. CD 9.",
        "1000% MATK. Invincible 2t. Heal 25%. CD 8.",
        "1100% MATK. Invincible 2t. Heal 30%. Stun all 2t. CD 8.",
        "1300% MATK. Invincible 2t. Heal 40%. Stun 2t. Resurrect downed ally at 50%. CD 7.",
      ],
    },
  },

  necromancer: {
    death_coil: {
      id: "death_coil", name: "Death Coil", emoji: "💀",
      branch: "A", type: "active", dmgType: "magic", element: "dark",
      mpCost: 15, cooldown: 1, multiplier: 1.1, requires: null,
      effect: { type: "curse", chance: 0.60, duration: 2 },
      rankScaling: [
        "110% MATK dark. 60% Curse 2t.",
        "130% MATK. 65% Curse 2t.",
        "150% MATK. 70% Curse 3t. Also -10% all stats.",
        "170% MATK. 75% Curse 3t. -15% all stats.",
        "200% MATK. 80% Curse 4t. -20% stats. If target dies while cursed: raises as skeleton.",
      ],
    },
    raise_skeleton: {
      id: "raise_skeleton", name: "Raise Skeleton", emoji: "💀",
      branch: "A", type: "active", dmgType: "special",
      mpCost: 40, cooldown: 3, requires: null,
      rankScaling: [
        "Raise 1 skeleton (25% your ATK, 30% your HP).",
        "Skeleton 30% ATK/35% HP.",
        "Skeleton 35%/40%. Can raise from dead enemies.",
        "Skeleton 40%/45%. Raise 2 simultaneously.",
        "Skeleton 50%/50%. Raise 3. Skeletons explode on death for 100% their HP AoE.",
      ],
    },
    plague: {
      id: "plague", name: "Plague", emoji: "🦠",
      branch: "B", type: "active", dmgType: "magic", element: "dark",
      mpCost: 35, cooldown: 4, requires: null,
      effect: { type: "poison", stacks: 3, duration: 5, aoe: true },
      rankScaling: [
        "Apply Poison ×3 to all enemies for 5t.",
        "Poison ×4, 5t.",
        "Poison ×5, 6t. Poison spreads to nearby targets on stack removal.",
        "Poison ×5, 7t. Spreads. Block 50% healing.",
        "Poison ×5, 8t. Spreads. Block 75% healing. Enemies die at 5% HP.",
      ],
    },
    death_nova: {
      id: "death_nova", name: "Death Nova", emoji: "☠️",
      branch: "C", type: "ultimate", dmgType: "magic", element: "dark",
      mpCost: 110, cooldown: 10, multiplier: 5.0, aoe: true, requires: "plague",
      rankScaling: [
        "500% MATK dark AoE. Raise all killed enemies. CD 10.",
        "600% MATK. Raise all killed. CD 10.",
        "700% MATK. Raise all. All existing undead +30% ATK. CD 9.",
        "800% MATK. Raise all. +40% undead ATK. Lifesteal 50% of damage. CD 9.",
        "1000% MATK. Raise all. +50% undead ATK. Lifesteal 60%. CD 8.",
      ],
    },
  },

  elementalist: {
    elemental_bolt: {
      id: "elemental_bolt", name: "Elemental Bolt", emoji: "🌊",
      branch: "A", type: "active", dmgType: "magic", element: "none",
      mpCost: 15, cooldown: 1, multiplier: 1.3, requires: null,
      rankScaling: [
        "130% MATK. Uses currently attuned element.",
        "150% MATK. 20% apply that element's status.",
        "170% MATK. 30% apply status.",
        "190% MATK. 40% apply status. Bonus 20% if target weak to element.",
        "210% MATK. 50% apply status. +30% vs weakness. Ignore 10% resistance.",
      ],
    },
    attune: {
      id: "attune", name: "Attune", emoji: "🔮",
      branch: "A", type: "active", dmgType: "special",
      mpCost: 0, cooldown: 0, requires: null,
      rankScaling: [
        "Switch attunement to: Fire, Ice, Lightning, Earth, Wind, Water. 0 cost.",
        "Also Dark, Light.",
        "Also Void. Attunement bonus: +15% that element's damage.",
        "+20% attunement bonus.",
        "+25% bonus. Dual attune: merge two elements for unique combos.",
      ],
    },
    elemental_fusion: {
      id: "elemental_fusion", name: "Elemental Fusion", emoji: "💥",
      branch: "B", type: "active", dmgType: "magic", element: "none",
      mpCost: 50, cooldown: 5, multiplier: 2.5, requires: null,
      rankScaling: [
        "Fire + Ice: Cryo blast 250% MATK. Freeze + Burn simultaneously.",
        "Lightning + Earth: Quake bolt 280% MATK. Stun + Bleed.",
        "Wind + Water: Cyclone 300% MATK AoE. Slow all + Confuse.",
        "Dark + Light: Eclipse 350% MATK. Curse + Holy burn. Ignore resistance.",
        "Any two: 400% MATK. Apply both element statuses. +40% if exploiting 2 weaknesses.",
      ],
    },
    prism_beam: {
      id: "prism_beam", name: "Prism Beam", emoji: "🌈",
      branch: "C", type: "ultimate", dmgType: "magic", element: "none",
      mpCost: 130, cooldown: 10, multiplier: 1.0, hits: 9, requires: "elemental_fusion",
      rankScaling: [
        "9 beams each using different element. 100% MATK each. CD 10.",
        "9 × 110% MATK. CD 10.",
        "9 × 120% MATK. Each beam applies its element's status. CD 9.",
        "9 × 130% MATK. All statuses applied. AoE. CD 9.",
        "9 × 150% MATK. AoE. All statuses. Exploit ALL elemental weaknesses. CD 8.",
      ],
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the full skill tree for a class.
 */
function getSkillTree(classId) {
  return SKILL_TREES[classId] ?? {};
}

/**
 * Get a single skill by class + skillId.
 */
function getSkill(classId, skillId) {
  return SKILL_TREES[classId]?.[skillId] ?? null;
}

/**
 * Get all skills in a branch for a class.
 * @param {string} classId
 * @param {"A"|"B"|"C"} branch
 */
function getBranchSkills(classId, branch) {
  return Object.values(SKILL_TREES[classId] ?? {}).filter(s => s.branch === branch);
}

/**
 * Check if a player meets prerequisites for a skill.
 * @param {{ skills: {skillId, rank}[] }} character
 * @param {object} skill
 * @returns {{ canLearn: boolean, reason: string|null }}
 */
function canLearnSkill(character, skill, classId) {
  // Ultimate requires Level 30 + 5 SP in Branch B
  if (skill.branch === "C") {
    if (character.level < 30) {
      return { canLearn: false, reason: "Requires Level 30." };
    }
    const bSkills   = getBranchSkills(classId, "B");
    const bSpent    = bSkills.reduce((sum, s) => {
      const learned = character.skills.find(cs => cs.skillId === s.id);
      return sum + (learned?.rank ?? 0);
    }, 0);
    if (bSpent < 5) {
      return { canLearn: false, reason: `Requires 5 SP spent in Branch B (have ${bSpent}).` };
    }
  }

  // Prerequisite skill
  if (skill.requires) {
    const prereq = character.skills.find(s => s.skillId === skill.requires);
    if (!prereq || prereq.rank < 1) {
      return { canLearn: false, reason: `Requires **${skill.requires.replace(/_/g, " ")}** first.` };
    }
  }

  return { canLearn: true, reason: null };
}

module.exports = { SKILL_TREES, getSkillTree, getSkill, getBranchSkills, canLearnSkill };
