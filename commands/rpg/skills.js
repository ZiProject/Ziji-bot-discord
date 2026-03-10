// commands/rpg/skills.js
// /rpg skills — view and upgrade your skill tree.
// Also contains all B_RPG_SKILLS_* and S_RPG_SKILLUP_* handlers.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useHooks } = require("zihooks");
const { Character } = useHooks.get("db");

const { getSkill, canLearnSkill } = require("../../data/skills");
const { buildSkillTreeEmbed, buildSkillUpConfirmEmbed } = require("../../functions/rpg/skillTreeUI");

// ─── Slash command metadata ───────────────────────────────────────────────────
module.exports.data = {
	name: "rpg", // subcommand of /rpg
	type: 1,
	enable: true,
	category: null,
};

// This file handles the "skills" subcommand — the parent /rpg command
// delegates to this file's handler via a subcommand router.

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMMAND HANDLER — called from commands/rpg/rpg.js router
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle /rpg skills
 */
async function handleSkills(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char) {
		return interaction.editReply({
			content: "❌ You don't have a character yet! Use `/rpg start`.",
		});
	}

	const { embed, rows } = buildSkillTreeEmbed(char, "A");
	return interaction.editReply({ embeds: [embed], components: rows });
}

module.exports.handleSkills = handleSkills;

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON: B_RPG_SKILLS_BRANCH_{A|B|C} — switch branch tab
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.branchSwitch = {
	data: { name: "B_RPG_SKILLS_BRANCH", type: "any", enable: true },

	execute: async (interaction) => {
		await interaction.deferUpdate();
		const branch = interaction.customId.split("_").at(-1); // A, B, or C

		const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
		if (!char) return interaction.followUp({ content: "❌ Character not found.", ephemeral: true });

		const { embed, rows } = buildSkillTreeEmbed(char, branch);
		return interaction.editReply({ embeds: [embed], components: rows });
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT: S_RPG_SKILLUP_{branch} — choose which skill to upgrade
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.skillUpSelect = {
	data: { name: "S_RPG_SKILLUP", type: "any", enable: true },

	execute: async (interaction) => {
		await interaction.deferUpdate();

		const skillId = interaction.values[0];
		const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
		if (!char) return interaction.followUp({ content: "❌ Character not found.", ephemeral: true });

		const skill = getSkill(char.class, skillId);
		if (!skill) return interaction.followUp({ content: "❌ Skill not found.", ephemeral: true });

		const currentRank = char.skills.find((s) => s.skillId === skillId)?.rank ?? 0;
		const newRank = currentRank + 1;

		if (newRank > 5) {
			return interaction.followUp({ content: "❌ This skill is already at max rank!", ephemeral: true });
		}

		// Prerequisite check
		const { canLearn, reason } = canLearnSkill(char, skill, char.class);
		if (!canLearn) {
			return interaction.followUp({ content: `❌ Cannot learn this skill: ${reason}`, ephemeral: true });
		}

		const { embed, rows } = buildSkillUpConfirmEmbed(char, skill, newRank);
		return interaction.editReply({ embeds: [embed], components: rows });
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON: B_RPG_SKILLUP_CONFIRM_{skillId} — spend SP and upgrade
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.skillUpConfirm = {
	data: { name: "B_RPG_SKILLUP_CONFIRM", type: "any", enable: true },

	execute: async (interaction) => {
		await interaction.deferUpdate();

		// customId: B_RPG_SKILLUP_CONFIRM_{skillId}
		// skillId may contain underscores, so rejoin from index 4
		const parts = interaction.customId.split("_");
		const skillId = parts.slice(4).join("_");

		const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
		if (!char) return interaction.followUp({ content: "❌ Character not found.", ephemeral: true });

		if (char.skillPoints <= 0) {
			return interaction.followUp({ content: "❌ No Skill Points available!", ephemeral: true });
		}

		const skill = getSkill(char.class, skillId);
		if (!skill) return interaction.followUp({ content: "❌ Skill not found.", ephemeral: true });

		// Prerequisite check again (safety)
		const { canLearn, reason } = canLearnSkill(char, skill, char.class);
		if (!canLearn) {
			return interaction.followUp({ content: `❌ ${reason}`, ephemeral: true });
		}

		const existingIdx = char.skills.findIndex((s) => s.skillId === skillId);
		const currentRank = existingIdx >= 0 ? char.skills[existingIdx].rank : 0;
		const newRank = currentRank + 1;

		if (newRank > 5) {
			return interaction.followUp({ content: "❌ Already at max rank!", ephemeral: true });
		}

		// Apply upgrade
		if (existingIdx >= 0) {
			char.skills[existingIdx].rank = newRank;
		} else {
			char.skills.push({ skillId, rank: 1 });
		}
		char.skillPoints--;

		// Apply passive bonuses immediately
		_applyPassiveBonus(char, skill, newRank);

		await char.save();

		const embed = new EmbedBuilder()
			.setColor(0x27ae60)
			.setTitle(`✅ Skill Upgraded!`)
			.setDescription(
				[
					`${skill.emoji} **${skill.name}** → Rank **${newRank}**`,
					``,
					`📖 ${skill.rankScaling[newRank - 1]}`,
					``,
					`**Skill Points remaining:** ${char.skillPoints}`,
				].join("\n"),
			);

		// Return to skill tree
		const backRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`B_RPG_SKILLS_BRANCH_${skill.branch}`)
				.setLabel("← Back to Skill Tree")
				.setStyle(ButtonStyle.Primary),
		);

		return interaction.editReply({ embeds: [embed], components: [backRow] });
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON: B_RPG_SKILLUP — shortcut upgrade button (from profile page)
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.skillUpButton = {
	data: { name: "B_RPG_SKILLUP", type: "any", enable: true },

	execute: async (interaction) => {
		await interaction.deferUpdate();

		const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
		if (!char) return interaction.followUp({ content: "❌ Character not found.", ephemeral: true });

		const { embed, rows } = buildSkillTreeEmbed(char, "A");
		return interaction.editReply({ embeds: [embed], components: rows });
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL: apply passive stat bonuses to character when a passive skill ranks up
// ═══════════════════════════════════════════════════════════════════════════════

function _applyPassiveBonus(char, skill, newRank) {
	if (skill.type !== "passive" || !skill.passive) return;

	const { stat, valuePerRank } = skill.passive;
	const increment = valuePerRank; // additional value for this rank

	switch (stat) {
		case "def":
			char.stats.def = Math.floor(char.stats.def * (1 + increment));
			char.stats.mdef = Math.floor(char.stats.mdef * (1 + increment * 0.5));
			break;
		case "crit":
			char.stats.crit = Math.min(0.8, char.stats.crit + increment);
			break;
		case "critDmg":
		case "crit_damage":
			char.stats.critDmg = Math.min(3.0, char.stats.critDmg + increment);
			break;
		case "hp_max":
			char.stats.maxHp = Math.floor(char.stats.maxHp * (1 + increment));
			char.stats.hp = Math.min(char.stats.hp + Math.floor(char.stats.maxHp * increment), char.stats.maxHp);
			break;
		case "heal_power":
			// Stored as a multiplier on character — checked by CombatEngine
			char._healPower = (char._healPower ?? 1.0) + increment;
			break;
		// spell_echo_chance, counter_chance, dodge_chance, low_hp_atk_bonus
		// are checked dynamically in CombatEngine via char.skills
		default:
			break;
	}
}
