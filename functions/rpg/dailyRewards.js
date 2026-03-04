// functions/rpg/dailyRewards.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles daily login rewards, quest generation, and gem income.
// Called from /rpg daily command and the daily quest completion handlers.
// ─────────────────────────────────────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// ─── Streak reward table ──────────────────────────────────────────────────────
// Index = day (1–7). Day 7 = big reward. Repeats every 7 days.
const STREAK_REWARDS = [
  { day: 1, gold: 500,   gems: 50,  label: "Day 1" },
  { day: 2, gold: 600,   gems: 60,  label: "Day 2" },
  { day: 3, gold: 700,   gems: 70,  label: "Day 3 ⭐" },
  { day: 4, gold: 800,   gems: 80,  label: "Day 4" },
  { day: 5, gold: 900,   gems: 90,  label: "Day 5 ⭐" },
  { day: 6, gold: 1000,  gems: 100, label: "Day 6" },
  { day: 7, gold: 2000,  gems: 300, label: "Day 7 🎉 BONUS", dungeonSeal: 1 },
];

// ─── Daily quest pool ─────────────────────────────────────────────────────────
const QUEST_POOL = {
  combat: [
    { id: "q_kill_10",     objective: "Defeat 10 enemies",          target: 10, reward: { xp: 200, gold: 300, gems: 20 } },
    { id: "q_kill_25",     objective: "Defeat 25 enemies",          target: 25, reward: { xp: 400, gold: 600, gems: 40 } },
    { id: "q_crit_5",      objective: "Land 5 critical hits",       target:  5, reward: { xp: 150, gold: 250, gems: 15 } },
    { id: "q_boss_kill",   objective: "Defeat 1 dungeon boss",      target:  1, reward: { xp: 800, gold: 800, gems: 80 } },
    { id: "q_no_deaths",   objective: "Clear a dungeon with no KOs", target: 1, reward: { xp: 600, gold: 700, gems: 60 } },
  ],
  dungeon: [
    { id: "q_dung_1",      objective: "Complete 1 dungeon run",     target:  1, reward: { xp: 300, gold: 400, gems: 30 } },
    { id: "q_dung_3",      objective: "Complete 3 dungeon runs",    target:  3, reward: { xp: 700, gold: 900, gems: 70 } },
    { id: "q_dung_b_tier", objective: "Complete a B-tier dungeon",  target:  1, reward: { xp: 500, gold: 600, gems: 50 } },
    { id: "q_floor_15",    objective: "Reach floor 15 in any dungeon",target:1, reward: { xp: 400, gold: 500, gems: 40 } },
  ],
  craft: [
    { id: "q_craft_3",     objective: "Craft 3 items",              target:  3, reward: { xp: 200, gold: 300, gems: 20 } },
    { id: "q_upgrade_1",   objective: "Upgrade 1 skill",            target:  1, reward: { xp: 150, gold: 200, gems: 20 } },
  ],
  social: [
    { id: "q_login",       objective: "Log in today",               target:  1, reward: { xp: 100, gold: 100, gems: 10 } },
    { id: "q_pull_once",   objective: "Do 1 gacha pull",            target:  1, reward: { xp: 150, gold: 150, gems: 15 } },
    { id: "q_party_dung",  objective: "Complete a party dungeon",   target:  1, reward: { xp: 500, gold: 600, gems: 50 } },
  ],
};

// ─── Weekly quest pool ────────────────────────────────────────────────────────
const WEEKLY_QUESTS = [
  { id: "wq_kill_100",   objective: "Defeat 100 enemies",        target: 100, reward: { xp: 2000, gold: 3000, gems: 200 }, isWeekly: true },
  { id: "wq_dung_10",    objective: "Complete 10 dungeons",      target:  10, reward: { xp: 3000, gold: 4000, gems: 300 }, isWeekly: true },
  { id: "wq_boss_5",     objective: "Defeat 5 dungeon bosses",   target:   5, reward: { xp: 4000, gold: 5000, gems: 400 }, isWeekly: true },
  { id: "wq_pull_30",    objective: "Do 30 gacha pulls",         target:  30, reward: { xp: 1500, gold: 2000, gems: 500 }, isWeekly: true },
  { id: "wq_level_up",   objective: "Gain 5 levels",             target:   5, reward: { xp: 5000, gold: 6000, gems: 600 }, isWeekly: true },
];

class DailyRewards {

  // ───────────────────────────────────────────────────────────────────────────
  // CLAIM DAILY
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to claim daily login reward.
   * @param {Character} char
   * @returns {{ ok: boolean, reason: string|null, reward: object|null, streakDay: number }}
   */
  static claimDaily(char) {
    const now       = new Date();
    const last      = char.lastDaily ? new Date(char.lastDaily) : null;
    const todayStr  = now.toISOString().split("T")[0];

    if (last) {
      const lastStr = last.toISOString().split("T")[0];

      // Already claimed today
      if (lastStr === todayStr) {
        const nextReset = new Date(now);
        nextReset.setUTCHours(0, 0, 0, 0);
        nextReset.setUTCDate(nextReset.getUTCDate() + 1);
        const resetTs = Math.floor(nextReset.getTime() / 1000);
        return {
          ok: false,
          reason: `❌ Already claimed today! Next reset: <t:${resetTs}:R>`,
          reward: null,
          streakDay: char.dailyStreak,
        };
      }

      // Check streak continuity (must claim within 24–48h window)
      const hoursSinceLast = (now - last) / (1000 * 60 * 60);
      if (hoursSinceLast > 48) {
        char.dailyStreak = 0; // reset streak
      }
    }

    // Advance streak
    char.dailyStreak = (char.dailyStreak % 7) + 1;
    char.lastDaily   = now;

    const reward     = STREAK_REWARDS[char.dailyStreak - 1];

    // Apply rewards
    char.currency.gold += reward.gold;
    char.currency.gems += reward.gems;
    if (reward.dungeonSeal) {
      const slot = char.inventory.find(i => i.itemId === "dungeon_seal");
      if (slot) slot.quantity++;
      else char.inventory.push({ itemId: "dungeon_seal", quantity: 1 });
    }

    return { ok: true, reason: null, reward, streakDay: char.dailyStreak };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GENERATE DAILY QUESTS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate 3 daily + 1 weekly quest if not already assigned today.
   * @param {Character} char
   * @returns {{ generated: boolean, quests: object[] }}
   */
  static generateDailyQuests(char) {
    const now      = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Check if quests were generated today
    const hasToday = char.activeQuests.some(
      q => !q.isWeekly && q.questId.startsWith("q_") &&
           new Date(q.assignedAt ?? 0).toISOString().split("T")[0] === todayStr
    );
    if (hasToday) return { generated: false, quests: char.activeQuests.filter(q => !q.isWeekly) };

    // Remove old daily quests (keep weekly)
    char.activeQuests = char.activeQuests.filter(q => q.isWeekly);

    // Pick 1 from each category: combat, dungeon, social
    const categories = ["combat", "dungeon", "social"];
    const newQuests  = [];
    for (const cat of categories) {
      const pool  = QUEST_POOL[cat];
      const quest = pool[Math.floor(Math.random() * pool.length)];
      newQuests.push({
        questId:    quest.id,
        type:       cat,
        objective:  quest.objective,
        progress:   0,
        target:     quest.target,
        reward:     quest.reward,
        completed:  false,
        isWeekly:   false,
        assignedAt: now,
      });
    }

    // Weekly quest — check if assigned this week
    const mondayStr = DailyRewards._getMondayStr(now);
    const hasWeekly = char.activeQuests.some(
      q => q.isWeekly && new Date(q.assignedAt ?? 0).toISOString().split("T")[0] >= mondayStr
    );

    if (!hasWeekly) {
      const wq = WEEKLY_QUESTS[Math.floor(Math.random() * WEEKLY_QUESTS.length)];
      newQuests.push({
        questId:    wq.id,
        type:       "weekly",
        objective:  wq.objective,
        progress:   0,
        target:     wq.target,
        reward:     wq.reward,
        completed:  false,
        isWeekly:   true,
        assignedAt: now,
      });
    }

    char.activeQuests.push(...newQuests);
    return { generated: true, quests: char.activeQuests };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE QUEST PROGRESS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Increment quest progress for all active quests matching the event type.
   * @param {Character}  char
   * @param {string}     eventType  — "kill", "dungeon_clear", "boss_kill", "pull", "craft", "level_up"
   * @param {number}     amount
   * @returns {{ completed: object[] }} — quests completed this call
   */
  static updateQuestProgress(char, eventType, amount = 1) {
    const EVENT_QUEST_MAP = {
      kill:          ["q_kill_10","q_kill_25","wq_kill_100"],
      dungeon_clear: ["q_dung_1","q_dung_3","q_no_deaths","wq_dung_10"],
      boss_kill:     ["q_boss_kill","wq_boss_5"],
      pull:          ["q_pull_once","wq_pull_30"],
      craft:         ["q_craft_3"],
      skill_up:      ["q_upgrade_1"],
      level_up:      ["wq_level_up"],
      crit:          ["q_crit_5"],
      login:         ["q_login"],
      b_tier_dung:   ["q_dung_b_tier"],
      floor_15:      ["q_floor_15"],
    };

    const validIds  = EVENT_QUEST_MAP[eventType] ?? [];
    const completed = [];

    for (const quest of char.activeQuests) {
      if (quest.completed)             continue;
      if (!validIds.includes(quest.questId)) continue;

      quest.progress = Math.min(quest.target, quest.progress + amount);

      if (quest.progress >= quest.target) {
        quest.completed = true;
        // Apply reward
        char.currency.gold += quest.reward.gold ?? 0;
        char.currency.gems += quest.reward.gems ?? 0;
        if (quest.reward.xp) char.awardXP(quest.reward.xp);
        completed.push(quest);
      }
    }

    return { completed };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BUILD DAILY EMBED
  // ───────────────────────────────────────────────────────────────────────────

  static buildDailyEmbed(char, streakReward, streakDay, quests) {
    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle(`🌅 Daily Rewards — Day ${streakDay}`)
      .setDescription(
        DailyRewards._streakCalendar(streakDay) + "\n\n" +
        `**Today's Reward:**\n` +
        `🪙 +${streakReward.gold.toLocaleString()} gold\n` +
        `💎 +${streakReward.gems} gems` +
        (streakReward.dungeonSeal ? "\n🔑 +1 Dungeon Seal" : "")
      );

    // Daily quests
    const dailyQ  = quests.filter(q => !q.isWeekly);
    const weeklyQ = quests.filter(q => q.isWeekly);

    if (dailyQ.length) {
      embed.addFields({
        name: "📋 Daily Quests",
        value: dailyQ.map(q =>
          `${q.completed ? "✅" : "🔲"} **${q.objective}** (${q.progress}/${q.target})\n` +
          `  → 🪙 ${q.reward.gold} · 💎 ${q.reward.gems} · XP ${q.reward.xp}`
        ).join("\n"),
        inline: false,
      });
    }

    if (weeklyQ.length) {
      embed.addFields({
        name: "📅 Weekly Quest",
        value: weeklyQ.map(q =>
          `${q.completed ? "✅" : "🔲"} **${q.objective}** (${q.progress}/${q.target})\n` +
          `  → 🪙 ${q.reward.gold} · 💎 ${q.reward.gems} · XP ${q.reward.xp}`
        ).join("\n"),
        inline: false,
      });
    }

    embed.setFooter({ text: "Complete quests to earn extra gems for gacha pulls! 🎰" });
    return embed;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  static _streakCalendar(currentDay) {
    const days = STREAK_REWARDS.map((r, i) => {
      const day  = i + 1;
      const mark = day < currentDay ? "✅" : day === currentDay ? "🟨" : "⬜";
      return `${mark} **${r.label}**: 💎${r.gems}`;
    });
    return days.join("  ");
  }

  static _getMondayStr(date) {
    const d   = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return d.toISOString().split("T")[0];
  }
}

module.exports = DailyRewards;
