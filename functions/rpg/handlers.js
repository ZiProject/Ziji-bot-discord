// functions/rpg/handlers.js
// ─────────────────────────────────────────────────────────────────────────────
// All B_DUNG_*, B_RPG_*, S_RPG_*, M_RPG_* interaction handlers.
// Each handler is exported as a zihooks function module.
// ─────────────────────────────────────────────────────────────────────────────

const { ActionRowBuilder, ButtonBuilder, ButtonStyle,
        ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require("discord.js");
const { useHooks }    = require("zihooks");
const Character       = require("../../models/Character");
const DungeonRun      = require("../../models/DungeonRun");
const DungeonEngine   = require("./dungeon");
const { CombatEngine } = require("./combat");
const { CLASSES }     = require("../../data/classes");

// ═══════════════════════════════════════════════════════════════════════════════
// S_RPG_CLASS_SELECT — class selection from /rpg start
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.classSelect = {
  data: { name: "S_RPG_CLASS_SELECT", type: "any", enable: true },

  execute: async (interaction) => {
    const classId = interaction.values[0];
    const cls     = CLASSES[classId];
    if (!cls) return interaction.reply({ content: "❌ Invalid class.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(cls.color)
      .setTitle(`${cls.emoji} ${cls.name}`)
      .setDescription(cls.description)
      .addFields(
        { name: "Role", value: cls.role, inline: true },
        { name: "Difficulty", value: cls.difficulty, inline: true },
        { name: "⚔️ Starter Stats", value: [
            `❤️ HP: **${cls.baseStats.hp}** | 💙 MP: **${cls.baseStats.mp}**`,
            `⚔️ ATK: **${cls.baseStats.atk}** | 🔮 MATK: **${cls.baseStats.matk}**`,
            `🛡️ DEF: **${cls.baseStats.def}** | 💨 SPD: **${cls.baseStats.spd}**`,
          ].join("\n"), inline: false },
        { name: "✨ Starting Skills", value: cls.startingSkills.join(", "), inline: true },
        { name: "📦 Starting Items", value: cls.startingItems.join(", "), inline: true },
        { name: "🏆 Advanced Class (Prestige)", value: `**${cls.advancedClass?.replace(/_/g," ") ?? "?"}** (unlocked at Lv 50)`, inline: false },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`B_RPG_CONFIRM_CLASS_${classId}`)
        .setLabel(`✅ Choose ${cls.name}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("B_RPG_BACK_CLASS")
        .setLabel("← Back")
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.update({ embeds: [embed], components: [row] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_CONFIRM_CLASS_{classId} — open name modal
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.confirmClass = {
  data: { name: "B_RPG_CONFIRM_CLASS", type: "any", enable: true },

  execute: async (interaction) => {
    // customId format: B_RPG_CONFIRM_CLASS_{classId}
    const classId = interaction.customId.split("_").at(-1);

    const modal = new ModalBuilder()
      .setCustomId(`M_RPG_NAME_${classId}`)
      .setTitle("⚔️ Name Your Hero");

    const nameInput = new TextInputBuilder()
      .setCustomId("hero_name")
      .setLabel("Character Name (max 32 characters)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(32)
      .setPlaceholder("Enter your hero's name...")
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// M_RPG_NAME_{classId} — create character after name input
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.nameModal = {
  data: { name: "M_RPG_NAME", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();

    // customId: M_RPG_NAME_{classId}
    const classId = interaction.customId.split("_").at(-1);
    const name    = interaction.fields.getTextInputValue("hero_name").trim();
    const cls     = CLASSES[classId];

    if (!cls) return interaction.followUp({ content: "❌ Invalid class.", ephemeral: true });

    // Final duplicate check
    const existing = await Character.findCharacter(interaction.user.id, interaction.guildId);
    if (existing) {
      return interaction.followUp({ content: `❌ You already have a character: **${existing.name}**`, ephemeral: true });
    }

    // Create character
    const char = await Character.create({
      userId:   interaction.user.id,
      guildId:  interaction.guildId,
      name,
      class:    classId,
      level:    1,
      xp:       0,
      stats:    { ...cls.baseStats },
      currency: { gold: 500, gems: 0, pvpTokens: 0, factionTokens: 0, stardust: 0, dungeonSeals: 3, darkCrystals: 0 },
      inventory: cls.startingItems.map(itemId => ({ itemId, quantity: 1 })),
    });

    const embed = new EmbedBuilder()
      .setColor(cls.color)
      .setTitle(`🎉 ${name} has entered the world!`)
      .setDescription(`Your **${cls.name}** hero is ready for adventure!\n\nUse \`/rpg dungeon\` to explore dungeons, \`/rpg profile\` to view your stats, and \`/rpg skills\` to build your skill tree.`)
      .addFields(
        { name: "Starting Package", value: cls.startingItems.join(", "), inline: false },
        { name: "Starting Gold", value: "🪙 500 gold", inline: true },
        { name: "Dungeon Seals", value: "🔑 3 seals", inline: true },
      )
      .setFooter({ text: "Good luck, hero! 🗡️" });

    return interaction.editReply({ embeds: [embed], components: [] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_DUNG_ENTER_{tier}_SOLO — start a solo dungeon run
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.dungeonEnterSolo = {
  data: { name: "B_DUNG_ENTER", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();

    // customId: B_DUNG_ENTER_{tier}_SOLO or _PARTY
    const parts  = interaction.customId.split("_");
    const tier   = parts[3];
    const mode   = parts[4]; // SOLO or PARTY

    if (mode === "PARTY") {
      return interaction.editReply({
        content: "👥 Party dungeon coming soon! Use solo mode for now.",
        components: [],
      });
    }

    const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
    if (!char) {
      return interaction.editReply({ content: "❌ Character not found.", components: [] });
    }

    const { run, error } = await DungeonEngine.startRun({
      partyLeaderId: interaction.user.id,
      guildId:       interaction.guildId,
      channelId:     interaction.channelId,
      tier,
      playerIds:     [interaction.user.id],
    });

    if (error) {
      return interaction.editReply({ content: `❌ ${error}`, components: [] });
    }

    // Build first floor
    const { run: updatedRun } = await DungeonEngine.advanceFloor(run, [char]);

    // Persist message ID after sending
    const { embed, rows } = CombatEngine.buildCombatEmbed(updatedRun, [
      `${CLASSES[char.class]?.emoji ?? "⚔️"} **${char.name}** enters **${updatedRun.dungeonName}**!`,
      `Floor 1/${updatedRun.totalFloors} — **${updatedRun.floorType.toUpperCase()}**`,
    ]);

    const msg = await interaction.editReply({ embeds: [embed], components: rows });

    // Save message ID for future updates
    updatedRun.messageId = msg.id;
    await updatedRun.save();
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_DUNG_CANCEL
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.dungeonCancel = {
  data: { name: "B_DUNG_CANCEL", type: "any", enable: true },

  execute: async (interaction) => {
    return interaction.update({ content: "❌ Dungeon cancelled.", embeds: [], components: [] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_ATTACK — basic attack in combat
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.combatAttack = {
  data: { name: "B_RPG_ATTACK", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { run, error } = await _getActiveRun(interaction);
    if (error) return interaction.followUp({ content: error, ephemeral: true });

    // Tick status effects for this player
    const player = run.getPlayer(interaction.user.id);
    const tickLog = CombatEngine.tickStatusEffects(player, interaction.user.id);

    const { log, run: updated, combatOver, victory } = await CombatEngine.resolvePlayerTurn(
      run, interaction.user.id, { type: "attack", targetIdx: 0 }
    );

    const allLog = [...tickLog, ...log];

    if (combatOver) {
      return _handleCombatEnd(interaction, updated, victory, allLog);
    }

    // Enemy turn(s)
    await _runEnemyTurns(updated, allLog);

    const { combatOver: over2, victory: v2 } = updated.isCombatOver();
    if (over2) return _handleCombatEnd(interaction, updated, v2, allLog);

    const { embed, rows } = CombatEngine.buildCombatEmbed(updated, allLog);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_DEFEND
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.combatDefend = {
  data: { name: "B_RPG_DEFEND", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { run, error } = await _getActiveRun(interaction);
    if (error) return interaction.followUp({ content: error, ephemeral: true });

    const tickLog = CombatEngine.tickStatusEffects(run.getPlayer(interaction.user.id), interaction.user.id);

    const { log, run: updated } = await CombatEngine.resolvePlayerTurn(
      run, interaction.user.id, { type: "defend" }
    );

    const allLog = [...tickLog, ...log];
    await _runEnemyTurns(updated, allLog);

    const { embed, rows } = CombatEngine.buildCombatEmbed(updated, allLog);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_FLEE
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.combatFlee = {
  data: { name: "B_RPG_FLEE", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { run, error } = await _getActiveRun(interaction);
    if (error) return interaction.followUp({ content: error, ephemeral: true });

    const { success, run: updated, runOver } = await DungeonEngine.attemptFlee(run, interaction.user.id);

    const msg = success
      ? `🏃 **${interaction.user.username}** successfully fled the dungeon!`
      : `❌ **${interaction.user.username}** failed to flee!`;

    if (runOver) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle("🏃 Dungeon Abandoned")
        .setDescription(msg + "\n\nAll party members have fled or been defeated.");
      return interaction.editReply({ embeds: [embed], components: [] });
    }

    const { embed, rows } = CombatEngine.buildCombatEmbed(updated, [msg]);
    return interaction.editReply({ embeds: [embed], components: rows });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_NEXT — advance to next floor after room clear
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.dungeonNext = {
  data: { name: "B_RPG_NEXT", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { run, error } = await _getActiveRun(interaction);
    if (error) return interaction.followUp({ content: error, ephemeral: true });

    // Check if run is complete
    if (run.currentFloor >= run.totalFloors && run.phase === "reward") {
      const { summaries } = await DungeonEngine.finishRun(run, true);
      return _buildVictoryEmbed(interaction, run, summaries);
    }

    const chars = await Promise.all(
      run.players.map(p => Character.findCharacter(p.userId, run.guildId))
    );

    const { run: updated, staminaError } = await DungeonEngine.advanceFloor(run, chars.filter(Boolean));
    if (staminaError) {
      return interaction.editReply({ content: `⚡ ${staminaError}`, components: [] });
    }

    if (updated.phase === "combat") {
      const { embed, rows } = CombatEngine.buildCombatEmbed(updated, [
        `🗺️ Floor **${updated.currentFloor}/${updated.totalFloors}** — **${updated.floorType.toUpperCase()}**`,
      ]);
      return interaction.editReply({ embeds: [embed], components: rows });
    }

    // Non-combat floor — show room embed + action button
    return _buildRoomEmbed(interaction, updated);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B_RPG_ROOM_ACTION — handle non-combat room interaction
// ═══════════════════════════════════════════════════════════════════════════════
module.exports.dungeonRoomAction = {
  data: { name: "B_RPG_ROOM_ACTION", type: "any", enable: true },

  execute: async (interaction) => {
    await interaction.deferUpdate();
    const { run, error } = await _getActiveRun(interaction);
    if (error) return interaction.followUp({ content: error, ephemeral: true });

    const { result, run: updated } = await DungeonEngine.resolveRoom(run, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x27AE60 : 0xE74C3C)
      .setTitle(`${result.success ? "✅" : "❌"} ${run.floorType.toUpperCase()} Room`)
      .setDescription(result.message);

    if (result.rewards?.loot?.length) {
      embed.addFields({ name: "📦 Loot", value: result.rewards.loot.map(l => `• ${l.item?.itemId}`).join("\n"), inline: false });
    }
    if (result.rewards?.gold) {
      embed.addFields({ name: "🪙 Gold", value: `+${result.rewards.gold}`, inline: true });
    }

    const nextRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("B_RPG_NEXT")
        .setLabel("▶️ Next Floor")
        .setStyle(ButtonStyle.Primary),
    );

    return interaction.editReply({ embeds: [embed], components: [nextRow] });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function _getActiveRun(interaction) {
  const run = await DungeonRun.findOne({ "players.userId": interaction.user.id, active: true });
  if (!run) return { run: null, error: "❌ You are not in an active dungeon run." };
  return { run, error: null };
}

async function _runEnemyTurns(run, log) {
  for (let i = 0; i < run.currentEnemies.length; i++) {
    const enemy = run.currentEnemies[i];
    if (enemy.hp <= 0) continue;

    // Tick enemy status effects
    const tickLog = CombatEngine.tickStatusEffects(enemy, `enemy_${i}`);
    log.push(...tickLog);

    const { log: elog } = await CombatEngine.resolveEnemyTurn(run, i);
    log.push(...elog);
  }
}

async function _handleCombatEnd(interaction, run, victory, log) {
  if (victory) {
    // Award monster loot
    const LootEngine = require("./lootEngine");
    const SeededRNG  = require("./seededRng");
    const rng        = new SeededRNG(Date.now());

    for (const enemy of run.currentEnemies) {
      const drops = LootEngine.rollMonsterLoot(enemy.lootTable ?? [], rng);
      for (const drop of drops) {
        for (const p of run.alivePlayers()) {
          p.lootCollected.push(drop.itemId);
          p.goldEarned  += Math.floor(Math.random() * (enemy.goldMax ?? 10) + (enemy.goldMin ?? 5));
          p.xpEarned    += enemy.xpReward ?? 20;
        }
        log.push(`📦 **${enemy.name}** dropped **${drop.itemId}** ×${drop.quantity}!`);
      }
    }

    run.floorLog.push({
      floorNumber: run.currentFloor,
      type:        run.floorType,
      outcome:     "victory",
      xpGained:    run.players[0]?.xpEarned ?? 0,
      goldGained:  run.players[0]?.goldEarned ?? 0,
    });

    // All enemies cleared → advance to reward phase
    run.phase     = "reward";
    run.updatedAt = new Date();
    await run.save();

    // Check if this was the boss floor
    const isFinalFloor = run.currentFloor >= run.totalFloors;
    if (isFinalFloor) {
      const { summaries } = await DungeonEngine.finishRun(run, true);
      return _buildVictoryEmbed(interaction, run, summaries, log);
    }

    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setTitle("✅ Victory!")
      .setDescription(log.slice(-8).join("\n").substring(0, 1024))
      .setFooter({ text: `Floor ${run.currentFloor}/${run.totalFloors} cleared!` });

    const nextRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("B_RPG_NEXT")
        .setLabel("▶️ Next Floor")
        .setStyle(ButtonStyle.Primary),
    );

    return interaction.editReply({ embeds: [embed], components: [nextRow] });

  } else {
    // Defeat
    const { summaries } = await DungeonEngine.finishRun(run, false);
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle("💀 Defeated!")
      .setDescription("Your party has been defeated...\n\n" + log.slice(-5).join("\n").substring(0, 900))
      .addFields({ name: "📊 Run Summary", value: summaries.map(s => `${s.name}: +${s.xp} XP, +${s.gold} gold`).join("\n") });

    return interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function _buildVictoryEmbed(interaction, run, summaries, log = []) {
  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle("🏆 Dungeon Cleared!")
    .setDescription(`**${run.dungeonName}** has been conquered!\n\n${log.slice(-4).join("\n")}`.substring(0, 1024))
    .addFields({
      name: "📊 Run Summary",
      value: summaries.map(s => [
        `**${s.name}**`,
        `+${s.xp.toLocaleString()} XP`,
        `+${s.gold.toLocaleString()} gold`,
        s.loot.length ? `📦 ${s.loot.slice(0, 3).join(", ")}${s.loot.length > 3 ? ` +${s.loot.length - 3} more` : ""}` : "",
        s.leveled ? `🎉 **Level Up! → ${s.newLevel}**` : "",
      ].filter(Boolean).join(" | ")).join("\n"),
      inline: false,
    })
    .setFooter({ text: `Floors cleared: ${run.totalFloors} • Run ended` });

  return interaction.editReply({ embeds: [embed], components: [] });
}

function _buildRoomEmbed(interaction, run) {
  const ROOM_ICONS = {
    rest:     "🏕️", treasure: "💰", trap: "💥",
    puzzle:   "🧩", explore:  "🗺️",
  };
  const icon = ROOM_ICONS[run.phase] ?? "🗺️";

  const embed = new EmbedBuilder()
    .setColor(0x2980B9)
    .setTitle(`${icon} Floor ${run.currentFloor}/${run.totalFloors} — ${run.phase.toUpperCase()}`)
    .setDescription(getRoomDescription(run.phase));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("B_RPG_ROOM_ACTION")
      .setLabel(`${icon} Interact`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("B_RPG_NEXT")
      .setLabel("⏭️ Skip Room")
      .setStyle(ButtonStyle.Secondary),
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

function getRoomDescription(type) {
  const DESCS = {
    rest:     "You find a quiet area to rest. The party can recover HP and MP here.",
    treasure: "A glittering chest sits before you. Who knows what lies within?",
    trap:     "You sense something off about this room... Proceed with caution.",
    puzzle:   "An ancient mechanism blocks your path. Solve the puzzle to proceed.",
  };
  return DESCS[type] ?? "You enter a mysterious room.";
}
