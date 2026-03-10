// commands/rpg/rpg.js — PATCH for Module 2
// Adds "skills" and "skillup" subcommands to the existing /rpg group.
// This file REPLACES the original commands/rpg/rpg.js.
// Only the additions are marked with // [M2] comments.

const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
} = require("discord.js");

const { useHooks } = require("zihooks");
const { Character, DungeonRun } = useHooks.get("db");

const { CLASSES } = require("../../data/classes");
const { DUNGEON_TIERS, getDungeonConfig } = require("../../data/dungeons");
const DungeonEngine = require("../../functions/rpg/dungeon");
// [M2] Skill imports
const { getSkill, getSkillTree } = require("../../data/skills");
const { buildSkillTreeEmbed } = require("../../functions/rpg/skillTreeUI");
const { handleSkills } = require("./skills");

module.exports.data = {
	name: "rpg",
	description: "Ziji RPG — Dungeon Crawler & Adventure System",
	type: 1,
	integration_types: [0],
	contexts: [0],
	enable: true,
	category: null,
};

// ── Slash command definition (updated with new subcommands) ──────────────────
const slashData = new SlashCommandBuilder()
	.setName("rpg")
	.setDescription("Ziji RPG System")
	.addSubcommand((sub) => sub.setName("start").setDescription("Create your RPG character!"))
	.addSubcommand((sub) =>
		sub
			.setName("profile")
			.setDescription("View your character profile")
			.addUserOption((opt) => opt.setName("user").setDescription("View another player (optional)")),
	)
	.addSubcommand((sub) =>
		sub
			.setName("dungeon")
			.setDescription("Enter a dungeon")
			.addStringOption((opt) =>
				opt
					.setName("tier")
					.setDescription("Dungeon tier")
					.setRequired(true)
					.addChoices(
						{ name: "D — Goblin Warren (Lv 1+)", value: "D" },
						{ name: "C — Cursed Catacombs (Lv 10+)", value: "C" },
						{ name: "B — Inferno Spire (Lv 20+)", value: "B" },
						{ name: "A — Abyssal Rift (Lv 35+)", value: "A" },
						{ name: "S — Titan's Vault (Lv 50+)", value: "S" },
						{ name: "EX — Void Nexus (Lv 75+)", value: "EX" },
					),
			),
	)
	// [M2] New subcommands
	.addSubcommand((sub) => sub.setName("skills").setDescription("View and upgrade your skill tree"))
	.addSubcommand((sub) =>
		sub
			.setName("skillup")
			.setDescription("Quickly upgrade a skill by name")
			.addStringOption((opt) => opt.setName("skill").setDescription("Skill ID to upgrade").setRequired(true)),
	)
	.addSubcommand((sub) => sub.setName("stats").setDescription("View detailed stat breakdown"));

module.exports.slashData = slashData;

module.exports.execute = async ({ interaction, lang }) => {
	const sub = interaction.options.getSubcommand();

	switch (sub) {
		case "start":
			return handleStart(interaction, lang);
		case "profile":
			return handleProfile(interaction, lang);
		case "dungeon":
			return handleDungeon(interaction, lang);
		case "skills":
			return handleSkills(interaction); // [M2]
		case "skillup":
			return handleQuickSkillUp(interaction); // [M2]
		case "stats":
			return handleStats(interaction); // [M2]
		default:
			return interaction.reply({ content: "❓ Unknown subcommand.", ephemeral: true });
	}
};

// ═══════════════════════════════════════════════════════════════════════════════
// [M2] /rpg skillup — quick skill upgrade via CLI
// ═══════════════════════════════════════════════════════════════════════════════
async function handleQuickSkillUp(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const skillIdInput = interaction.options.getString("skill").toLowerCase().replace(/ /g, "_");
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);

	if (!char) return interaction.editReply({ content: "❌ No character found. Use `/rpg start`." });

	const skill = getSkill(char.class, skillIdInput);
	if (!skill) {
		// Fuzzy hint: show available skills
		const tree = getSkillTree(char.class);
		const names = Object.values(tree)
			.map((s) => `\`${s.id}\``)
			.join(", ");
		return interaction.editReply({
			content: `❌ Skill \`${skillIdInput}\` not found for your class.\n\nAvailable skills: ${names}`,
		});
	}

	const { canLearn, reason } = require("../../data/skills").canLearnSkill(char, skill, char.class);
	if (!canLearn) return interaction.editReply({ content: `❌ ${reason}` });

	const currentRank = char.skills.find((s) => s.skillId === skillIdInput)?.rank ?? 0;
	if (currentRank >= 5) return interaction.editReply({ content: "❌ Already at max rank!" });
	if (char.skillPoints <= 0) return interaction.editReply({ content: "❌ No Skill Points! Level up to earn more." });

	const { buildSkillUpConfirmEmbed } = require("../../functions/rpg/skillTreeUI");
	const { embed, rows } = buildSkillUpConfirmEmbed(char, skill, currentRank + 1);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// [M2] /rpg stats — detailed stat panel
// ═══════════════════════════════════════════════════════════════════════════════
async function handleStats(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });

	char._regenStamina();
	const cls = CLASSES[char.class];

	// Compute passive bonuses from skills
	const PassiveResolver = require("../../functions/rpg/passiveResolver");
	const passives = PassiveResolver.resolve(char, char.class, char.skills);

	const embed = new EmbedBuilder()
		.setColor(cls?.color ?? 0x1e3a5f)
		.setTitle(`📊 ${char.name} — Full Stats`)
		.setDescription(`**${cls?.name}** Lv${char.level} ${char.advancedClass ? `*(${char.advancedClass})*` : ""}`)
		.addFields(
			{
				name: "⚔️ Offensive",
				value: [
					`ATK:        **${char.stats.atk}**`,
					`MATK:       **${char.stats.matk}**`,
					`CRIT Rate:  **${Math.round(char.stats.crit * 100)}%** (+${Math.round(passives.spellEchoChance * 100)}% Echo)`,
					`CRIT DMG:   **+${Math.round(char.stats.critDmg * 100)}%**`,
				].join("\n"),
				inline: true,
			},
			{
				name: "🛡️ Defensive",
				value: [
					`HP:    **${char.stats.hp} / ${char.stats.maxHp}**`,
					`MP:    **${char.stats.mp} / ${char.stats.maxMp}**`,
					`DEF:   **${char.stats.def}**`,
					`MDEF:  **${char.stats.mdef}**`,
				].join("\n"),
				inline: true,
			},
			{
				name: "💨 Utility",
				value: [
					`SPD:           **${char.stats.spd}**`,
					`Stamina:       **${char.stamina}/120**`,
					`Dodge Chance:  **${Math.round(passives.dodgeChance * 100)}%**`,
					`Counter Chance:**${Math.round(passives.counterChance * 100)}%**`,
				].join("\n"),
				inline: true,
			},
			{
				name: "📚 Skill Passives",
				value: [
					`Spell Echo:      ${passives.spellEchoChance > 0 ? `**${Math.round(passives.spellEchoChance * 100)}%**` : "—"}`,
					`Lifesteal/Kill:  ${passives.lifestealOnKill > 0 ? `**${Math.round(passives.lifestealOnKill * 100)}% HP**` : "—"}`,
					`Heal Bonus:      ${passives.healPowerBonus > 1 ? `**+${Math.round((passives.healPowerBonus - 1) * 100)}%**` : "—"}`,
					`Low HP ATK:      ${passives.lowHpAtkPerTen > 0 ? `**+${Math.round(passives.lowHpAtkPerTen * 100)}%/10%HP**` : "—"}`,
					`Undying Rage:    ${passives.undyingRage ? "✅ Active" : "—"}`,
				].join("\n"),
				inline: false,
			},
			{
				name: "🌟 Skill Points",
				value: `Available: **${char.skillPoints}** SP\nTotal Spent: **${char.skills.reduce((s, sk) => s + sk.rank, 0)}** SP`,
				inline: true,
			},
			{
				name: "📈 Skills Learned",
				value: char.skills.length > 0 ? char.skills.map((s) => `\`${s.skillId}\` R${s.rank}`).join(", ") : "*None yet*",
				inline: false,
			},
		)
		.setFooter({ text: "Use /rpg skills to upgrade your skill tree." });

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_RPG_SKILLS_BRANCH_A").setLabel("🌳 Open Skill Tree").setStyle(ButtonStyle.Primary),
	);

	return interaction.editReply({ embeds: [embed], components: [row] });
}

// ── Keep original handlers from Module 1 below ───────────────────────────────

async function handleStart(interaction, lang) {
	const existing = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (existing) {
		return interaction.reply({
			content: `⚔️ You already have a character: **${existing.name}** (${existing.class}, Lv ${existing.level})`,
			ephemeral: true,
		});
	}

	const embed = new EmbedBuilder()
		.setColor(0x1e3a5f)
		.setTitle("⚔️ Welcome to Ziji RPG!")
		.setDescription("Choose a class to begin your adventure!")
		.setFooter({ text: "Prestige to an Advanced Class at Level 50." });

	for (const cls of Object.values(CLASSES)) {
		embed.addFields({
			name: `${cls.emoji} ${cls.name} — *${cls.role}*`,
			value: `${cls.description}\n**Difficulty:** ${cls.difficulty}`,
			inline: false,
		});
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("S_RPG_CLASS_SELECT")
		.setPlaceholder("Choose your class...")
		.addOptions(
			Object.values(CLASSES).map((cls) => ({
				label: cls.name,
				description: cls.role,
				value: cls.id,
				emoji: cls.emoji,
			})),
		);

	return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
}

async function handleProfile(interaction, lang) {
	await interaction.deferReply();
	const targetUser = interaction.options.getUser("user") ?? interaction.user;
	const char = await Character.findCharacter(targetUser.id, interaction.guildId);

	if (!char) {
		return interaction.editReply({
			content:
				targetUser.id === interaction.user.id ?
					"❌ No character yet! Use `/rpg start`."
				:	`❌ **${targetUser.username}** doesn't have a character.`,
		});
	}

	const cls = CLASSES[char.class];
	const xpNeeded = Math.floor(100 * Math.pow(char.level, 2));
	const bar = (cur, max, len, fill, empty) =>
		fill.repeat(Math.round(Math.max(0, Math.min(1, cur / max)) * len)) +
		empty.repeat(len - Math.round(Math.max(0, Math.min(1, cur / max)) * len));

	char._regenStamina();

	const embed = new EmbedBuilder()
		.setColor(cls?.color ?? 0x1e3a5f)
		.setTitle(`${cls?.emoji ?? "⚔️"} ${char.name}`)
		.setDescription(`**Class:** ${char.advancedClass ?? cls?.name}  **Level:** ${char.level}`)
		.addFields(
			{
				name: "❤️ HP",
				value: `${bar(char.stats.hp, char.stats.maxHp, 10, "🟩", "⬛")}\n${char.stats.hp}/${char.stats.maxHp}`,
				inline: true,
			},
			{
				name: "💙 MP",
				value: `${bar(char.stats.mp, char.stats.maxMp, 10, "🟦", "⬛")}\n${char.stats.mp}/${char.stats.maxMp}`,
				inline: true,
			},
			{ name: "⚡ Stamina", value: `${bar(char.stamina, 120, 8, "🟧", "⬛")}\n${char.stamina}/120`, inline: true },
			{
				name: "📊 Stats",
				value: `⚔️ ATK: **${char.stats.atk}** | 🔮 MATK: **${char.stats.matk}**\n🛡️ DEF: **${char.stats.def}** | 🔰 MDEF: **${char.stats.mdef}**\n💨 SPD: **${char.stats.spd}** | 🎯 CRIT: **${Math.round(char.stats.crit * 100)}%**`,
				inline: false,
			},
			{
				name: "📈 XP",
				value: `${bar(char.xp, xpNeeded, 12, "🟨", "⬛")}\n${char.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}`,
				inline: false,
			},
			{
				name: "💰 Wallet",
				value: `🪙 **${char.currency.gold.toLocaleString()}** gold | 💎 **${char.currency.gems}** gems`,
				inline: false,
			},
			{ name: "🌟 Skill Points", value: `**${char.skillPoints}** SP available`, inline: true },
		)
		.setFooter({ text: `Kills: ${char.combatStats.killCount} • Dungeons: ${char.combatStats.dungeonClears}` });

	// [M2] Add skill tree button to profile
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId("B_RPG_SKILLS_BRANCH_A")
			.setLabel("🌳 Skill Tree")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(targetUser.id !== interaction.user.id),
		new ButtonBuilder()
			.setCustomId("B_RPG_SKILLUP")
			.setLabel(`✨ Upgrade Skills (${char.skillPoints} SP)`)
			.setStyle(char.skillPoints > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(char.skillPoints <= 0 || targetUser.id !== interaction.user.id),
	);

	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleDungeon(interaction, lang) {
	await interaction.deferReply();
	const tier = interaction.options.getString("tier");
	const config = getDungeonConfig(tier);
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);

	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });
	if (char.level < config.reqLevel)
		return interaction.editReply({ content: `❌ Need Level **${config.reqLevel}**+ for ${config.name}.` });

	char._regenStamina();

	const embed = new EmbedBuilder()
		.setColor(config.color)
		.setTitle(`${config.emoji} Enter ${config.name}?`)
		.setDescription(config.description)
		.addFields(
			{
				name: "Info",
				value: `Tier **${tier}** · Floors **${config.floors}** · Stamina **${config.staminaCost}**/floor · Drops **${config.dropQuality.join(" → ")}**`,
				inline: false,
			},
			{ name: "Your Level", value: `${char.level}`, inline: true },
			{ name: "Your Stamina", value: `${char.stamina}/120`, inline: true },
		);

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`B_DUNG_ENTER_${tier}_SOLO`).setLabel("⚔️ Enter Solo").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(`B_DUNG_ENTER_${tier}_PARTY`).setLabel("👥 Party").setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId("B_DUNG_CANCEL").setLabel("❌ Cancel").setStyle(ButtonStyle.Secondary),
	);

	return interaction.editReply({ embeds: [embed], components: [row] });
}
