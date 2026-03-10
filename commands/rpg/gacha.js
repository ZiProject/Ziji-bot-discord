// commands/rpg/gacha.js
// /gacha — main command group
//   /gacha banners    — list all active banners
//   /gacha pull       — pull on a banner
//   /gacha pity       — check pity status
//   /gacha collection — view owned items
//   /gacha history    — pull history
//   /gacha shop       — stardust shop
//   /gacha gems       — gem balance + ways to get gems

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const { useHooks } = require("zihooks");
const { Character, GachaBanner, GachaPlayer } = useHooks.get("db");

const GachaEngine = require("../../functions/rpg/gachaEngine");
const {
	buildBannerListEmbed,
	buildBannerDetailEmbed,
	buildPullResultEmbed,
	buildHistoryEmbed,
	buildPityEmbed,
	buildStardustShopEmbed,
	buildCollectionEmbed,
} = require("../../functions/rpg/gachaUI");

// ─── Metadata ─────────────────────────────────────────────────────────────────
module.exports.data = {
	name: "gacha",
	description: "Ziji RPG — Gacha Summon System",
	type: 1,
	integration_types: [0],
	contexts: [0],
	enable: true,
	category: null,
};

const slashData = new SlashCommandBuilder()
	.setName("gacha")
	.setDescription("Gacha — summon heroes and weapons")

	.addSubcommand((sub) => sub.setName("banners").setDescription("View all active gacha banners"))

	.addSubcommand((sub) =>
		sub
			.setName("pull")
			.setDescription("Pull on a banner")
			.addStringOption((opt) => opt.setName("banner").setDescription("Banner to pull on").setRequired(true).setAutocomplete(true))
			.addIntegerOption((opt) =>
				opt
					.setName("count")
					.setDescription("Number of pulls")
					.addChoices({ name: "×1", value: 1 }, { name: "×10", value: 10 })
					.setRequired(true),
			),
	)

	.addSubcommand((sub) =>
		sub
			.setName("pity")
			.setDescription("Check your pity counters")
			.addStringOption((opt) => opt.setName("banner").setDescription("Banner to check").setRequired(false).setAutocomplete(true)),
	)

	.addSubcommand((sub) =>
		sub
			.setName("collection")
			.setDescription("View your collection")
			.addStringOption((opt) =>
				opt
					.setName("rarity")
					.setDescription("Filter by rarity")
					.setRequired(false)
					.addChoices(
						{ name: "All", value: "all" },
						{ name: "Legendary", value: "legendary" },
						{ name: "Mythic", value: "mythic" },
						{ name: "Epic", value: "epic" },
						{ name: "Rare", value: "rare" },
					),
			),
	)

	.addSubcommand((sub) =>
		sub
			.setName("history")
			.setDescription("View your recent pull history")
			.addStringOption((opt) =>
				opt.setName("banner").setDescription("Filter by banner").setRequired(false).setAutocomplete(true),
			),
	)

	.addSubcommand((sub) => sub.setName("shop").setDescription("Spend stardust on exclusive items"))

	.addSubcommand((sub) => sub.setName("gems").setDescription("Check your gem balance and how to earn more"));

module.exports.slashData = slashData;

// ─── Autocomplete ─────────────────────────────────────────────────────────────
module.exports.autocomplete = async ({ interaction }) => {
	const focused = interaction.options.getFocused().toLowerCase();
	const banners = await GachaBanner.find({ active: true }).lean();
	const filtered = banners.filter((b) => b.name.toLowerCase().includes(focused) || b.bannerId.includes(focused)).slice(0, 25);

	return interaction.respond(filtered.map((b) => ({ name: b.name.substring(0, 100), value: b.bannerId })));
};

// ─── Execute ──────────────────────────────────────────────────────────────────
module.exports.execute = async ({ interaction, lang }) => {
	const sub = interaction.options.getSubcommand();

	switch (sub) {
		case "banners":
			return handleBanners(interaction);
		case "pull":
			return handlePull(interaction);
		case "pity":
			return handlePity(interaction);
		case "collection":
			return handleCollection(interaction);
		case "history":
			return handleHistory(interaction);
		case "shop":
			return handleShop(interaction);
		case "gems":
			return handleGems(interaction);
		default:
			return interaction.reply({ content: "❓ Unknown subcommand.", ephemeral: true });
	}
};

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha banners
// ═══════════════════════════════════════════════════════════════════════════════
async function handleBanners(interaction) {
	await interaction.deferReply();

	const [char, banners] = await Promise.all([
		Character.findCharacter(interaction.user.id, interaction.guildId),
		GachaBanner.find({ active: true }).lean(),
	]);

	if (!char) return interaction.editReply({ content: "❌ No character yet. Use `/rpg start`." });

	const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
	const { embed, rows } = buildBannerListEmbed(banners, player, char);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha pull
// ═══════════════════════════════════════════════════════════════════════════════
async function handlePull(interaction) {
	await interaction.deferReply();

	const bannerId = interaction.options.getString("banner");
	const count = interaction.options.getInteger("count") ?? 1;

	const [char, banner, player] = await Promise.all([
		Character.findCharacter(interaction.user.id, interaction.guildId),
		GachaBanner.findOne({ bannerId, active: true }),
		GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId),
	]);

	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });
	if (!banner) return interaction.editReply({ content: "❌ Banner not found or no longer active." });

	const { ok, reason } = GachaEngine.canPull(player, banner, count, char);
	if (!ok) return interaction.editReply({ content: reason });

	// Execute pulls
	const { results, totalCost } = GachaEngine.pull(player, banner, count, char);

	// Apply material rewards to character
	await _applyMaterialRewards(char, results);

	// Persist
	await Promise.all([char.save(), player.save(), banner.save()]);

	const { embed, rows } = buildPullResultEmbed(results, banner, player, char);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha pity
// ═══════════════════════════════════════════════════════════════════════════════
async function handlePity(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const bannerId = interaction.options.getString("banner");

	const [player, banners] = await Promise.all([
		GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId),
		bannerId ? GachaBanner.find({ bannerId, active: true }).lean() : GachaBanner.find({ active: true }).lean(),
	]);

	if (!banners.length) return interaction.editReply({ content: "❌ Banner not found." });

	if (bannerId) {
		const { embed, rows } = buildPityEmbed(banners[0], player);
		return interaction.editReply({ embeds: [embed], components: rows });
	}

	// Show all pity states
	const embed = new EmbedBuilder()
		.setColor(0x2980b9)
		.setTitle("🎯 Your Pity Status — All Banners")
		.setDescription(`Total Pulls: **${player.totalPulls}**  |  Legendaries: **${player.totalLegendary}**`);

	for (const banner of banners) {
		const pityState = player.getPityState(banner.bannerId);
		const pity = pityState.pityCounter ?? 0;
		const { buildPityBar } = require("../../functions/rpg/gachaUI");
		embed.addFields({
			name: `${banner.emoji} ${banner.name}`,
			value: [
				`Pity: ${buildPityBar(pity, banner.hardPity, 12)} **${pity}/${banner.hardPity}**`,
				pityState.guaranteedRateUp ? "✅ Guaranteed rate-up" : "🎲 50/50",
			].join("\n"),
			inline: true,
		});
	}

	return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha collection
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCollection(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const rarity = interaction.options.getString("rarity") ?? "all";
	const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
	const { embed, rows } = buildCollectionEmbed(player, rarity, 0);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha history
// ═══════════════════════════════════════════════════════════════════════════════
async function handleHistory(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const bannerId = interaction.options.getString("banner") ?? null;
	const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
	const embed = buildHistoryEmbed(player, bannerId);
	return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha shop
// ═══════════════════════════════════════════════════════════════════════════════
async function handleShop(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const player = await GachaPlayer.findOrCreate(interaction.user.id, interaction.guildId);
	const { embed, rows } = buildStardustShopEmbed(player);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /gacha gems
// ═══════════════════════════════════════════════════════════════════════════════
async function handleGems(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });

	const embed = new EmbedBuilder()
		.setColor(0x9b59b6)
		.setTitle("💎 Gem Balance")
		.setDescription(`You have **${char.currency.gems.toLocaleString()}** 💎 gems`)
		.addFields(
			{
				name: "📅 Daily Ways to Earn Gems",
				value: [
					"✅ **Daily Login** — 50–100 gems",
					"⚔️ **Dungeon Clear** — 10–50 gems (tier dependent)",
					"🏆 **Daily Quest** — up to 150 gems",
					"📅 **Weekly Quest** — up to 500 gems",
				].join("\n"),
				inline: false,
			},
			{
				name: "🌍 Event Ways to Earn Gems",
				value: [
					"👾 **World Boss** — top 10 get 200–500 gems",
					"🏰 **Faction War** — winning faction: 300 gems",
					"🥇 **Arena Top 10** — monthly 200–1000 gems",
					"🏅 **Achievements** — one-time 100–2000 gems",
				].join("\n"),
				inline: false,
			},
			{
				name: "💡 Gem Cost Reference",
				value: [
					"Single pull: **300** 💎",
					"10x pull: **2700** 💎 (10% off)",
					"Weapon banner single: **240** 💎",
					"Beginner banner single: **150** 💎",
				].join("\n"),
				inline: false,
			},
		);

	return interaction.editReply({ embeds: [embed] });
}

// ─── Helper: apply material drops to character inventory ─────────────────────
async function _applyMaterialRewards(char, results) {
	for (const result of results) {
		if (result.type === "material") {
			switch (result.itemId) {
				case "material_summon_crystal":
					char.currency.gems += 50;
					break;
				case "material_hero_xp":
					char.awardXP(500);
					break;
				case "material_gold_pouch":
					char.currency.gold += 1000;
					break;
				case "material_stardust_bag":
					// stardust already added via recordPull
					break;
				default: {
					const slot = char.inventory.find((i) => i.itemId === result.itemId);
					if (slot) slot.quantity++;
					else char.inventory.push({ itemId: result.itemId, quantity: 1 });
				}
			}
		}
	}
}
