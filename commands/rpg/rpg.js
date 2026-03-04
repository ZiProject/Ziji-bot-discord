// commands/rpg/rpg.js
// Main RPG command group. Handles: start, profile, dungeon.
// Other subcommands (skills, inventory, craft, etc.) are in separate files.

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
        ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const Character   = require("../../models/Character");
const DungeonRun  = require("../../models/DungeonRun");
const { CLASSES } = require("../../data/classes");
const { DUNGEON_TIERS, getDungeonConfig } = require("../../data/dungeons");
const DungeonEngine = require("../../functions/rpg/dungeon");

// ─── Rarity colours for embeds ───────────────────────────────────────────────
const RARITY_COLORS = {
  common:    0x95A5A6, uncommon: 0x27AE60, rare:    0x2980B9,
  epic:      0x8E44AD, legendary:0xF39C12, mythic:  0xE67E22,
  unique:    0xE74C3C,
};

module.exports.data = {
  name: "rpg",
  description: "Ziji RPG — Dungeon Crawler & Adventure System",
  type: 1,
  integration_types: [0],
  contexts: [0],
  enable: true,
  category: null,
};

// ─── Slash command definition ─────────────────────────────────────────────────
const slashData = new SlashCommandBuilder()
  .setName("rpg")
  .setDescription("Ziji RPG System")

  // /rpg start
  .addSubcommand(sub => sub
    .setName("start")
    .setDescription("Create your RPG character and begin your adventure!"))

  // /rpg profile
  .addSubcommand(sub => sub
    .setName("profile")
    .setDescription("View your character profile")
    .addUserOption(opt => opt.setName("user").setDescription("View another player's profile (optional)")))

  // /rpg dungeon
  .addSubcommand(sub => sub
    .setName("dungeon")
    .setDescription("Enter a dungeon")
    .addStringOption(opt => opt
      .setName("tier")
      .setDescription("Dungeon tier")
      .setRequired(true)
      .addChoices(
        { name: "D — Goblin Warren (Lv 1+)",    value: "D" },
        { name: "C — Cursed Catacombs (Lv 10+)", value: "C" },
        { name: "B — Inferno Spire (Lv 20+)",    value: "B" },
        { name: "A — Abyssal Rift (Lv 35+)",     value: "A" },
        { name: "S — Titan's Vault (Lv 50+)",    value: "S" },
        { name: "EX — Void Nexus (Lv 75+)",      value: "EX" },
      )));

module.exports.slashData = slashData;

// ─── Execute ──────────────────────────────────────────────────────────────────
module.exports.execute = async ({ interaction, lang }) => {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "start":    return handleStart(interaction, lang);
    case "profile":  return handleProfile(interaction, lang);
    case "dungeon":  return handleDungeon(interaction, lang);
    default:
      return interaction.reply({ content: "❓ Unknown subcommand.", ephemeral: true });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// /rpg start
// ═══════════════════════════════════════════════════════════════════════════════

async function handleStart(interaction, lang) {
  const existing = await Character.findCharacter(interaction.user.id, interaction.guildId);

  if (existing) {
    return interaction.reply({
      content: `⚔️ You already have a character: **${existing.name}** (${existing.class}, Lv ${existing.level})\nUse \`/rpg profile\` to view them.`,
      ephemeral: true,
    });
  }

  // Build class selection embed
  const embed = new EmbedBuilder()
    .setColor(0x1E3A5F)
    .setTitle("⚔️ Welcome to Ziji RPG!")
    .setDescription("Begin your adventure by choosing a class. Each class has a unique playstyle and skill tree.\n\nSelect a class below to see their stats and description.")
    .setFooter({ text: "You can Prestige to an Advanced Class at Level 50." });

  // Add class summaries
  for (const cls of Object.values(CLASSES)) {
    embed.addFields({
      name: `${cls.emoji} ${cls.name} — *${cls.role}*`,
      value: `${cls.description}\n**Difficulty:** ${cls.difficulty}`,
      inline: false,
    });
  }

  // Class select menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("S_RPG_CLASS_SELECT")
    .setPlaceholder("Choose your class...")
    .addOptions(
      Object.values(CLASSES).map(cls => ({
        label:       cls.name,
        description: cls.role,
        value:       cls.id,
        emoji:       cls.emoji,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /rpg profile
// ═══════════════════════════════════════════════════════════════════════════════

async function handleProfile(interaction, lang) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser("user") ?? interaction.user;
  const char = await Character.findCharacter(targetUser.id, interaction.guildId);

  if (!char) {
    return interaction.editReply({
      content: targetUser.id === interaction.user.id
        ? "❌ You haven't created a character yet! Use `/rpg start`."
        : `❌ **${targetUser.username}** doesn't have a character yet.`,
    });
  }

  const cls      = CLASSES[char.class];
  const xpNeeded = Math.floor(100 * Math.pow(char.level, 2));
  const xpBar    = buildBar(char.xp, xpNeeded, 12, "🟨", "⬛");
  const hpBar    = buildBar(char.stats.hp, char.stats.maxHp, 10, "🟩", "⬛");
  const mpBar    = buildBar(char.stats.mp, char.stats.maxMp, 10, "🟦", "⬛");
  const staminaBar = buildBar(char.stamina, 120, 8, "🟧", "⬛");

  char._regenStamina(); // make stamina display accurate

  const embed = new EmbedBuilder()
    .setColor(cls?.color ?? 0x1E3A5F)
    .setTitle(`${cls?.emoji ?? "⚔️"} ${char.name}`)
    .setDescription([
      `**Class:** ${char.advancedClass ? `${char.advancedClass} (Prestige ${char.prestige})` : cls?.name}`,
      `**Level:** ${char.level}${char.level >= 200 ? " *(MAX)*" : ""}`,
      `**Guild:** ${interaction.guild.name}`,
    ].join("\n"))
    .addFields(
      { name: "❤️ HP", value: `${hpBar}\n${char.stats.hp}/${char.stats.maxHp}`, inline: true },
      { name: "💙 MP", value: `${mpBar}\n${char.stats.mp}/${char.stats.maxMp}`, inline: true },
      { name: "⚡ Stamina", value: `${staminaBar}\n${char.stamina}/120`, inline: true },
      { name: "📊 Stats", value: [
          `⚔️ ATK: **${char.stats.atk}** | 🔮 MATK: **${char.stats.matk}**`,
          `🛡️ DEF: **${char.stats.def}** | 🔰 MDEF: **${char.stats.mdef}**`,
          `💨 SPD: **${char.stats.spd}** | 🎯 CRIT: **${Math.round(char.stats.crit * 100)}%**`,
        ].join("\n"), inline: false },
      { name: "📈 XP", value: `${xpBar}\n${char.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}`, inline: false },
      { name: "💰 Wallet", value: [
          `🪙 Gold: **${char.currency.gold.toLocaleString()}**`,
          `💎 Gems: **${char.currency.gems}**`,
          `🔑 Dungeon Seals: **${char.currency.dungeonSeals}**`,
        ].join(" | "), inline: false },
      { name: "📜 Combat Record", value: [
          `✅ Wins: **${char.combatStats.wins}**`,
          `❌ Losses: **${char.combatStats.losses}**`,
          `⚔️ Kills: **${char.combatStats.killCount}**`,
          `🗺️ Dungeons: **${char.combatStats.dungeonClears}**`,
        ].join(" | "), inline: false },
    )
    .setFooter({ text: `Skill Points: ${char.skillPoints} available • ID: ${char.userId}` })
    .setTimestamp(char.createdAt);

  return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /rpg dungeon
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDungeon(interaction, lang) {
  await interaction.deferReply();

  const tier   = interaction.options.getString("tier");
  const config = getDungeonConfig(tier);
  const char   = await Character.findCharacter(interaction.user.id, interaction.guildId);

  if (!char) {
    return interaction.editReply({
      content: "❌ You don't have a character yet! Use `/rpg start` to create one.",
    });
  }

  // Level check
  if (char.level < config.reqLevel) {
    return interaction.editReply({
      content: `❌ You need to be at least **Level ${config.reqLevel}** to enter **${config.name}**. (You are Level ${char.level})`,
    });
  }

  // Stamina preview
  char._regenStamina();
  const totalStamina = config.staminaCost * config.floors;

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(`${config.emoji} Enter ${config.name}?`)
    .setDescription(config.description)
    .addFields(
      { name: "📊 Dungeon Info", value: [
          `**Tier:** ${tier} | **Floors:** ${config.floors}`,
          `**Level Requirement:** ${config.reqLevel}+`,
          `**Stamina Cost:** ${config.staminaCost} per floor (~${totalStamina} total)`,
          `**Drop Quality:** ${config.dropQuality.join(" → ")}`,
        ].join("\n"), inline: false },
      { name: "⚡ Your Stamina", value: `${char.stamina}/120`, inline: true },
      { name: "📈 Your Level", value: `${char.level}`, inline: true },
    );

  if (config.requiresSeal) {
    const hasSeal = char.inventory.find(i => i.itemId === "dungeon_seal" && i.quantity > 0);
    embed.addFields({
      name: "🔑 Dungeon Seal",
      value: hasSeal ? "✅ You have a Dungeon Seal." : "❌ **Requires a Dungeon Seal!** (Get them from daily quests or World Boss drops)",
      inline: false,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`B_DUNG_ENTER_${tier}_SOLO`)
      .setLabel("⚔️ Enter Solo")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`B_DUNG_ENTER_${tier}_PARTY`)
      .setLabel("👥 Enter with Party")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("B_DUNG_CANCEL")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function buildBar(current, max, length, fillEmoji, emptyEmoji) {
  const ratio  = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  return fillEmoji.repeat(filled) + emptyEmoji.repeat(length - filled);
}
