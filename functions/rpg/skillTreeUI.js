// functions/rpg/skillTreeUI.js
// Builds paginated Discord embeds for the /rpg skills command.
// Also provides the skill-up action builder.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
        StringSelectMenuBuilder } = require("discord.js");
const { getSkillTree, getBranchSkills } = require("../../data/skills");
const { CLASSES } = require("../../data/classes");

// ─── Constants ────────────────────────────────────────────────────────────────
const BRANCH_NAMES = { A: "⚔️ Core", B: "🌟 Mastery", C: "💥 Ultimate" };
const BRANCH_COLORS = { A: 0x3498DB, B: 0x9B59B6, C: 0xE74C3C };
const RANK_STARS = (rank, max = 5) => "⭐".repeat(rank) + "☆".repeat(max - rank);

/**
 * Build the main skill tree embed for a character.
 *
 * @param {object} char     — Character mongoose document
 * @param {"A"|"B"|"C"} branch
 * @returns {{ embed: EmbedBuilder, rows: ActionRowBuilder[] }}
 */
function buildSkillTreeEmbed(char, branch = "A") {
  const cls      = CLASSES[char.class];
  const tree     = getSkillTree(char.class);
  const skills   = getBranchSkills(char.class, branch);
  const spTotal  = char.skills.reduce((s, sk) => s + sk.rank, 0);

  const embed = new EmbedBuilder()
    .setColor(BRANCH_COLORS[branch])
    .setTitle(`${cls?.emoji ?? "⚔️"} ${char.name} — Skill Tree`)
    .setDescription([
      `**Class:** ${cls?.name}  **Level:** ${char.level}`,
      `**Skill Points Available:** \`${char.skillPoints}\` SP`,
      `**Total SP Spent:** \`${spTotal}\``,
      ``,
      `> Use the buttons below to switch branches or upgrade skills.`,
    ].join("\n"));

  // ── Skill entries ─────────────────────────────────────────────────────────
  for (const skill of skills) {
    const learned = char.skills.find(s => s.skillId === skill.id);
    const rank    = learned?.rank ?? 0;
    const maxed   = rank >= 5;

    const statusIcon = rank === 0 ? "🔒" : maxed ? "✅" : "📈";
    const rankBar    = rank > 0 ? RANK_STARS(rank) : "Not learned";
    const currentDesc = rank > 0
      ? skill.rankScaling[rank - 1]
      : "*Not learned yet*";
    const nextDesc = rank < 5 && rank >= 0
      ? `\n➡️ **Rank ${rank + 1}:** ${skill.rankScaling[rank]}`
      : "";

    const prereqText = skill.requires
      ? `\n🔗 Requires: \`${skill.requires.replace(/_/g, " ")}\``
      : "";

    const branchLabel = skill.branch === "C" ? "  *(Requires Lv30 + 5SP in B)*" : "";

    embed.addFields({
      name: `${statusIcon} ${skill.emoji} **${skill.name}**${branchLabel}`,
      value: [
        `${rankBar}  ${rank > 0 ? `MP: ${skill.mpCost}  CD: ${skill.cooldown ?? 0}t` : ""}`,
        `📖 ${currentDesc}${nextDesc}${prereqText}`,
      ].join("\n").substring(0, 1024),
      inline: false,
    });
  }

  embed.setFooter({ text: `Branch ${branch} • ${BRANCH_NAMES[branch]} • ${skills.length} skills` });

  // ── Rows ──────────────────────────────────────────────────────────────────
  const rows = [];

  // Branch switcher
  const branchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("B_RPG_SKILLS_BRANCH_A")
      .setLabel("⚔️ Core")
      .setStyle(branch === "A" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("B_RPG_SKILLS_BRANCH_B")
      .setLabel("🌟 Mastery")
      .setStyle(branch === "B" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("B_RPG_SKILLS_BRANCH_C")
      .setLabel("💥 Ultimate")
      .setStyle(branch === "C" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  rows.push(branchRow);

  // Skill-up select menu (only skills not maxed and with SP available)
  if (char.skillPoints > 0) {
    const upgradeable = skills.filter(s => {
      const rank = char.skills.find(cs => cs.skillId === s.id)?.rank ?? 0;
      return rank < 5;
    });

    if (upgradeable.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`S_RPG_SKILLUP_${branch}`)
        .setPlaceholder(`✨ Upgrade a skill (${char.skillPoints} SP available)...`)
        .addOptions(
          upgradeable.map(skill => {
            const rank = char.skills.find(s => s.skillId === skill.id)?.rank ?? 0;
            return {
              label:       skill.name,
              description: `Rank ${rank} → ${rank + 1}: ${skill.rankScaling[rank]?.substring(0, 50)}...`,
              value:       skill.id,
              emoji:       skill.emoji,
            };
          })
        );
      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }
  } else {
    embed.setDescription(embed.data.description + "\n\n> ⚠️ No Skill Points available. Level up to earn more!");
  }

  return { embed, rows };
}

/**
 * Build a confirmation embed before spending SP.
 *
 * @param {object} char
 * @param {object} skill    — skill definition
 * @param {number} newRank  — rank being upgraded to
 */
function buildSkillUpConfirmEmbed(char, skill, newRank) {
  const cls = CLASSES[char.class];

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle(`✨ Upgrade: ${skill.emoji} ${skill.name}?`)
    .setDescription([
      `**${skill.name}** Rank ${newRank - 1} → **Rank ${newRank}**`,
      `Cost: **1 SP** (You have: ${char.skillPoints} SP)`,
      ``,
      `**Current (Rank ${newRank - 1}):**`,
      newRank > 1 ? `> ${skill.rankScaling[newRank - 2]}` : `> *Not yet learned*`,
      ``,
      `**After Upgrade (Rank ${newRank}):**`,
      `> ${skill.rankScaling[newRank - 1]}`,
    ].join("\n"));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_RPG_SKILLUP_CONFIRM_${skill.id}`)
      .setLabel(`✅ Confirm Upgrade`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`B_RPG_SKILLS_BRANCH_${skill.branch}`)
      .setLabel("← Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [row] };
}

/**
 * Build a simple skill info embed for one skill.
 */
function buildSkillInfoEmbed(char, skill) {
  const learned = char.skills.find(s => s.skillId === skill.id);
  const rank    = learned?.rank ?? 0;

  const embed = new EmbedBuilder()
    .setColor(BRANCH_COLORS[skill.branch])
    .setTitle(`${skill.emoji} ${skill.name}`)
    .setDescription([
      `**Branch:** ${BRANCH_NAMES[skill.branch]}  **Type:** ${skill.type}`,
      `**Current Rank:** ${RANK_STARS(rank)}  **(${rank}/5)**`,
      skill.dmgType !== "passive" && skill.dmgType !== "buff" && skill.dmgType !== "special"
        ? `**MP Cost:** ${skill.mpCost}  **Cooldown:** ${skill.cooldown ?? 0} turns`
        : "",
      skill.element && skill.element !== "none" ? `**Element:** ${skill.element}` : "",
    ].filter(Boolean).join("\n"));

  for (let r = 1; r <= 5; r++) {
    embed.addFields({
      name: `${r <= rank ? "✅" : "🔒"} Rank ${r}`,
      value: skill.rankScaling[r - 1],
      inline: false,
    });
  }

  return embed;
}

module.exports = { buildSkillTreeEmbed, buildSkillUpConfirmEmbed, buildSkillInfoEmbed };
