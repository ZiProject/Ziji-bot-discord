// commands/rpg/daily.js
// /rpg daily — claim daily login reward and view active quests.
// This is a subcommand of /rpg, handled via the rpg.js router.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const DailyRewards = require("../../functions/rpg/dailyRewards");
const { useHooks } = require("zihooks");
const { Character } = useHooks.get("db");

/**
 * Handle /rpg daily
 */
async function handleDaily(interaction) {
	await interaction.deferReply();

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });

	// Try claim
	const { ok, reason, reward, streakDay } = DailyRewards.claimDaily(char);
	if (!ok) return interaction.editReply({ content: reason });

	// Generate quests
	const { generated, quests } = DailyRewards.generateDailyQuests(char);

	// Auto-complete "login" quest
	DailyRewards.updateQuestProgress(char, "login", 1);

	await char.save();

	const embed = DailyRewards.buildDailyEmbed(char, reward, streakDay, quests);

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_RPG_PROFILE").setLabel("👤 View Profile").setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId("B_GACHA_LIST").setLabel("🎰 Go Pull").setStyle(ButtonStyle.Success),
	);

	return interaction.editReply({ embeds: [embed], components: [row] });
}

module.exports = { handleDaily };
