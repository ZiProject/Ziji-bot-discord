// commands/rpg/faction.js
// /faction — full faction management command group
//
//   /faction create  <name> <tag>
//   /faction info    [faction]
//   /faction join    <faction>
//   /faction leave
//   /faction members [page]
//   /faction donate  <amount>
//   /faction hall
//   /faction upgrade <upgrade>
//   /faction territory
//   /faction war declare <faction> [territory]
//   /faction war roster  [position]
//   /faction war status
//   /faction war attack           (siege attack)
//   /faction war surrender
//   /faction kick    <user>
//   /faction rank    <user> <rank>
//   /faction leaderboard

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const { useHooks } = require("zihooks");
const { Character, Faction, FactionWar } = useHooks.get("db");

const FactionEngine = require("../../functions/rpg/factionEngine");
const WarEngine = require("../../functions/rpg/warEngine");

const {
	buildFactionEmbed,
	buildMemberListEmbed,
	buildTerritoryMapEmbed,
	buildHallEmbed,
	buildWarDeclareEmbed,
	buildWarStatusEmbed,
	buildWarResultEmbed,
	buildLeaderboardEmbed,
} = require("../../functions/rpg/factionUI");
const { HALL_UPGRADES, TERRITORIES } = require("../../data/factions");

module.exports.data = {
	name: "faction",
	description: "Faction Wars — create and manage your faction",
	type: 1,
	integration_types: [0],
	contexts: [0],
	enable: true,
	category: null,
};

const slashData = new SlashCommandBuilder()
	.setName("faction")
	.setDescription("Faction system")

	.addSubcommand((s) =>
		s
			.setName("create")
			.setDescription("Create a new faction")
			.addStringOption((o) => o.setName("name").setDescription("Faction name (max 32 chars)").setRequired(true))
			.addStringOption((o) => o.setName("tag").setDescription("Short tag [2-5 chars]").setRequired(true))
			.addStringOption((o) => o.setName("emoji").setDescription("Faction emoji").setRequired(false))
			.addStringOption((o) => o.setName("description").setDescription("Faction description").setRequired(false)),
	)

	.addSubcommand((s) =>
		s
			.setName("info")
			.setDescription("View a faction")
			.addStringOption((o) => o.setName("faction").setDescription("Faction name or tag").setRequired(false)),
	)

	.addSubcommand((s) =>
		s
			.setName("join")
			.setDescription("Join a faction")
			.addStringOption((o) => o.setName("faction").setDescription("Faction name or tag").setRequired(true)),
	)

	.addSubcommand((s) => s.setName("leave").setDescription("Leave your current faction"))

	.addSubcommand((s) =>
		s
			.setName("members")
			.setDescription("View faction member list")
			.addIntegerOption((o) => o.setName("page").setDescription("Page number").setRequired(false)),
	)

	.addSubcommand((s) =>
		s
			.setName("donate")
			.setDescription("Donate gold to the faction treasury")
			.addIntegerOption((o) => o.setName("amount").setDescription("Gold to donate").setRequired(true).setMinValue(100)),
	)

	.addSubcommand((s) => s.setName("hall").setDescription("View Faction Hall upgrades"))

	.addSubcommand((s) =>
		s
			.setName("upgrade")
			.setDescription("Upgrade a Faction Hall building")
			.addStringOption((o) =>
				o
					.setName("upgrade")
					.setDescription("Upgrade to buy")
					.setRequired(true)
					.addChoices(...Object.values(HALL_UPGRADES).map((u) => ({ name: `${u.emoji} ${u.name}`, value: u.id }))),
			),
	)

	.addSubcommand((s) => s.setName("territory").setDescription("View the territory map"))

	.addSubcommandGroup((g) =>
		g
			.setName("war")
			.setDescription("Faction war commands")
			.addSubcommand((s) =>
				s
					.setName("declare")
					.setDescription("Declare war on another faction")
					.addStringOption((o) => o.setName("faction").setDescription("Target faction name or tag").setRequired(true))
					.addStringOption((o) =>
						o
							.setName("territory")
							.setDescription("Territory to contest")
							.setRequired(false)
							.addChoices(...Object.values(TERRITORIES).map((t) => ({ name: `${t.emoji} ${t.name}`, value: t.id }))),
					),
			)
			.addSubcommand((s) =>
				s
					.setName("roster")
					.setDescription("Sign up for the relay battle roster")
					.addIntegerOption((o) =>
						o
							.setName("position")
							.setDescription("Battle order (1=first, 5=last)")
							.setRequired(false)
							.setMinValue(1)
							.setMaxValue(5),
					),
			)
			.addSubcommand((s) => s.setName("status").setDescription("View live war status"))
			.addSubcommand((s) => s.setName("attack").setDescription("Attack the siege target (costs 5 stamina)"))
			.addSubcommand((s) => s.setName("surrender").setDescription("Surrender the current war")),
	)

	.addSubcommand((s) =>
		s
			.setName("kick")
			.setDescription("Kick a member")
			.addUserOption((o) => o.setName("user").setDescription("Member to kick").setRequired(true)),
	)

	.addSubcommand((s) =>
		s
			.setName("rank")
			.setDescription("Change a member's rank")
			.addUserOption((o) => o.setName("user").setDescription("Target member").setRequired(true))
			.addStringOption((o) =>
				o
					.setName("rank")
					.setDescription("New rank")
					.setRequired(true)
					.addChoices(
						{ name: "Officer", value: "officer" },
						{ name: "Elite", value: "elite" },
						{ name: "Member", value: "member" },
					),
			),
	)

	.addSubcommand((s) => s.setName("leaderboard").setDescription("View top factions"));

module.exports.slashData = slashData;

// ─── Autocomplete ─────────────────────────────────────────────────────────────
module.exports.autocomplete = async ({ interaction }) => {
	const focused = interaction.options.getFocused().toLowerCase();
	const factions = await Faction.find({
		guildId: interaction.guildId,
		$or: [{ name: { $regex: focused, $options: "i" } }, { tag: { $regex: focused, $options: "i" } }],
	})
		.limit(25)
		.lean();
	return interaction.respond(factions.map((f) => ({ name: `[${f.tag}] ${f.name}`, value: f.name })));
};

// ─── Execute ──────────────────────────────────────────────────────────────────
module.exports.execute = async ({ interaction }) => {
	const group = interaction.options.getSubcommandGroup(false);
	const sub = interaction.options.getSubcommand();

	if (group === "war") {
		switch (sub) {
			case "declare":
				return handleWarDeclare(interaction);
			case "roster":
				return handleWarRoster(interaction);
			case "status":
				return handleWarStatus(interaction);
			case "attack":
				return handleWarAttack(interaction);
			case "surrender":
				return handleWarSurrender(interaction);
		}
	}

	switch (sub) {
		case "create":
			return handleCreate(interaction);
		case "info":
			return handleInfo(interaction);
		case "join":
			return handleJoin(interaction);
		case "leave":
			return handleLeave(interaction);
		case "members":
			return handleMembers(interaction);
		case "donate":
			return handleDonate(interaction);
		case "hall":
			return handleHall(interaction);
		case "upgrade":
			return handleUpgrade(interaction);
		case "territory":
			return handleTerritory(interaction);
		case "kick":
			return handleKick(interaction);
		case "rank":
			return handleRank(interaction);
		case "leaderboard":
			return handleLeaderboard(interaction);
		default:
			return interaction.reply({ content: "❓ Unknown subcommand.", ephemeral: true });
	}
};

// ═══════════════════════════════════════════════════════════════════════════════
// /faction create
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCreate(interaction) {
	await interaction.deferReply();
	const name = interaction.options.getString("name");
	const tag = interaction.options.getString("tag");
	const emoji = interaction.options.getString("emoji") ?? "⚔️";
	const desc = interaction.options.getString("description") ?? "";

	if (tag.length < 2 || tag.length > 5) {
		return interaction.editReply({ content: "❌ Tag must be 2–5 characters." });
	}

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char) return interaction.editReply({ content: "❌ No character. Use `/rpg start`." });

	const { faction, error } = await FactionEngine.create(
		{ userId: interaction.user.id, guildId: interaction.guildId, name, tag, emoji, description: desc },
		char,
	);
	if (error) return interaction.editReply({ content: error });

	const embed = new EmbedBuilder()
		.setColor(0x27ae60)
		.setTitle(`✅ Faction Created: ${emoji} [${faction.tag}] ${faction.name}`)
		.setDescription(
			[
				`You are now the leader of **${faction.name}**!`,
				`Recruit members with \`/faction info\` and share your tag: **[${faction.tag}]**`,
				`Donate gold with \`/faction donate\` to build up the treasury.`,
				``,
				`💸 **10,000 gold** deducted from your balance.`,
			].join("\n"),
		);

	return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction info
// ═══════════════════════════════════════════════════════════════════════════════
async function handleInfo(interaction) {
	await interaction.deferReply();

	const query = interaction.options.getString("faction") ?? null;
	let faction;

	if (query) {
		faction = await Faction.findOne({
			guildId: interaction.guildId,
			$or: [{ name: { $regex: `^${query}$`, $options: "i" } }, { tag: query.toUpperCase() }],
		});
	} else {
		const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
		if (char?.factionId) faction = await Faction.findById(char.factionId);
	}

	if (!faction) return interaction.editReply({ content: "❌ Faction not found. Specify a name or join one first." });

	const memberChars = await Character.find({
		userId: { $in: faction.members.map((m) => m.userId) },
		guildId: interaction.guildId,
	}).lean();
	faction.recalculatePower(memberChars);
	await faction.save();

	const embed = buildFactionEmbed(faction, memberChars);

	const rows = [];
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) {
		const joinRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`B_FACTION_JOIN_${faction._id}`)
				.setLabel(`Join ${faction.name}`)
				.setStyle(ButtonStyle.Success)
				.setDisabled(faction.members.length >= faction.maxMembers),
		);
		rows.push(joinRow);
	}

	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction join
// ═══════════════════════════════════════════════════════════════════════════════
async function handleJoin(interaction) {
	await interaction.deferReply();
	const query = interaction.options.getString("faction");

	const [char, faction] = await Promise.all([
		Character.findCharacter(interaction.user.id, interaction.guildId),
		Faction.findOne({
			guildId: interaction.guildId,
			$or: [{ name: { $regex: `^${query}$`, $options: "i" } }, { tag: query.toUpperCase() }],
		}),
	]);

	if (!char) return interaction.editReply({ content: "❌ No character." });
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, error } = await FactionEngine.join(faction, char);
	if (!ok) return interaction.editReply({ content: error });

	return interaction.editReply({ content: `✅ You have joined **${faction.emoji} ${faction.name}** [${faction.tag}]!` });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction leave
// ═══════════════════════════════════════════════════════════════════════════════
async function handleLeave(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, disbanded, error } = await FactionEngine.leave(faction, char);
	if (!ok) return interaction.editReply({ content: error });

	return interaction.editReply({
		content:
			disbanded ?
				`✅ You left **${faction.name}** and it was disbanded (no members remaining).`
			:	`✅ You have left **${faction.name}**.`,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction members
// ═══════════════════════════════════════════════════════════════════════════════
async function handleMembers(interaction) {
	await interaction.deferReply();
	const page = Math.max(0, (interaction.options.getInteger("page") ?? 1) - 1);
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const memberChars = await Character.find({
		userId: { $in: faction.members.map((m) => m.userId) },
		guildId: interaction.guildId,
	}).lean();
	const { embed, rows } = buildMemberListEmbed(faction, memberChars, page);
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction donate
// ═══════════════════════════════════════════════════════════════════════════════
async function handleDonate(interaction) {
	await interaction.deferReply();
	const amount = interaction.options.getInteger("amount");
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, tokensEarned, error } = await FactionEngine.donate(faction, char, amount);
	if (!ok) return interaction.editReply({ content: error });

	return interaction.editReply({
		content: `✅ Donated **${amount.toLocaleString()}** 🪙 gold to **${faction.name}**! Earned **${tokensEarned}** 🎖️ faction tokens.`,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction hall
// ═══════════════════════════════════════════════════════════════════════════════
async function handleHall(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const embed = buildHallEmbed(faction);
	return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction upgrade
// ═══════════════════════════════════════════════════════════════════════════════
async function handleUpgrade(interaction) {
	await interaction.deferReply();
	const upgradeId = interaction.options.getString("upgrade");
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, newLevel, cost, error } = await FactionEngine.upgradeHall(faction, interaction.user.id, upgradeId);
	if (!ok) return interaction.editReply({ content: error });

	const upgDef = HALL_UPGRADES[upgradeId];
	return interaction.editReply({
		content: `✅ **${upgDef.emoji} ${upgDef.name}** upgraded to Level **${newLevel}**!\nCost: 🪙 ${cost.gold.toLocaleString()} + 🎖️ ${cost.tokens} tokens`,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction territory
// ═══════════════════════════════════════════════════════════════════════════════
async function handleTerritory(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const [faction, allFactions] = await Promise.all([
		Faction.findById(char.factionId),
		Faction.find({ guildId: interaction.guildId }).lean(),
	]);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const embed = buildTerritoryMapEmbed(faction, allFactions);
	return interaction.editReply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction war declare
// ═══════════════════════════════════════════════════════════════════════════════
async function handleWarDeclare(interaction) {
	await interaction.deferReply();
	const targetName = interaction.options.getString("faction");
	const targetTerritory = interaction.options.getString("territory") ?? null;

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const [attacker, defender] = await Promise.all([
		Faction.findById(char.factionId),
		Faction.findOne({
			guildId: interaction.guildId,
			$or: [{ name: { $regex: `^${targetName}$`, $options: "i" } }, { tag: targetName.toUpperCase() }],
		}),
	]);
	if (!attacker) return interaction.editReply({ content: "❌ Your faction not found." });
	if (!defender) return interaction.editReply({ content: "❌ Target faction not found." });

	const { war, error } = await WarEngine.declareWar(
		attacker,
		defender,
		interaction.user.id,
		targetTerritory,
		interaction.channelId,
	);
	if (error) return interaction.editReply({ content: error });

	const embed = buildWarDeclareEmbed(attacker, defender, targetTerritory);
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`B_WAR_ROSTER_${war._id}`).setLabel("✋ Join Roster").setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(`B_WAR_STATUS_${war._id}`).setLabel("📊 War Status").setStyle(ButtonStyle.Secondary),
	);

	return interaction.editReply({ embeds: [embed], components: [row] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction war roster
// ═══════════════════════════════════════════════════════════════════════════════
async function handleWarRoster(interaction) {
	await interaction.deferReply({ ephemeral: true });
	const position = interaction.options.getInteger("position") ?? 5;

	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction?.currentWarId) return interaction.editReply({ content: "❌ Your faction is not in a war." });

	const war = await FactionWar.findById(faction.currentWarId);
	if (!war) return interaction.editReply({ content: "❌ War not found." });

	const { ok, error } = await WarEngine.joinRoster(war, char, position);
	if (!ok) return interaction.editReply({ content: error });

	const { team } = war.getTeam(char.factionId.toString());
	return interaction.editReply({
		content: `✅ **${char.name}** added to the roster at position **${position}**!\nCurrent roster: ${team.roster.map((p) => p.name).join(", ")}`,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction war status
// ═══════════════════════════════════════════════════════════════════════════════
async function handleWarStatus(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ You are not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction?.currentWarId) return interaction.editReply({ content: "❌ No active war." });

	const war = await FactionWar.findById(faction.currentWarId);
	if (!war) return interaction.editReply({ content: "❌ War not found." });

	const embed = buildWarStatusEmbed(war);
	const rows = _buildWarActionRows(war, char.factionId.toString());
	return interaction.editReply({ embeds: [embed], components: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction war attack
// ═══════════════════════════════════════════════════════════════════════════════
async function handleWarAttack(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ Not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction?.currentWarId) return interaction.editReply({ content: "❌ No active war." });

	const war = await FactionWar.findById(faction.currentWarId);
	if (!war) return interaction.editReply({ content: "❌ War not found." });

	const { damage, log, siegeEnded } = await WarEngine.attackSiege(war, char);
	if (!damage && log.startsWith("❌")) return interaction.editReply({ content: log });

	const embed = buildWarStatusEmbed(await FactionWar.findById(war._id));

	if (siegeEnded) {
		const resultEmbed = buildWarResultEmbed(await FactionWar.findById(war._id));
		return interaction.editReply({ content: `⚔️ ${log}`, embeds: [resultEmbed] });
	}

	return interaction.editReply({
		content: `⚔️ ${log}`,
		embeds: [embed],
		components: _buildWarActionRows(war, char.factionId.toString()),
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction war surrender
// ═══════════════════════════════════════════════════════════════════════════════
async function handleWarSurrender(interaction) {
	await interaction.deferReply();
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ Not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction?.currentWarId) return interaction.editReply({ content: "❌ No active war." });

	const war = await FactionWar.findById(faction.currentWarId);
	const { ok, error } = await WarEngine.surrender(war, char.factionId, interaction.user.id);
	if (!ok) return interaction.editReply({ content: error });

	const resultEmbed = buildWarResultEmbed(await FactionWar.findById(war._id));
	return interaction.editReply({ content: "🏳️ Your faction has surrendered.", embeds: [resultEmbed] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction kick
// ═══════════════════════════════════════════════════════════════════════════════
async function handleKick(interaction) {
	await interaction.deferReply({ ephemeral: true });
	const target = interaction.options.getUser("user");
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ Not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, error } = await FactionEngine.kick(faction, interaction.user.id, target.id);
	if (!ok) return interaction.editReply({ content: error });

	return interaction.editReply({ content: `✅ **${target.username}** has been kicked from ${faction.name}.` });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction rank
// ═══════════════════════════════════════════════════════════════════════════════
async function handleRank(interaction) {
	await interaction.deferReply({ ephemeral: true });
	const target = interaction.options.getUser("user");
	const newRank = interaction.options.getString("rank");
	const char = await Character.findCharacter(interaction.user.id, interaction.guildId);
	if (!char?.factionId) return interaction.editReply({ content: "❌ Not in a faction." });

	const faction = await Faction.findById(char.factionId);
	if (!faction) return interaction.editReply({ content: "❌ Faction not found." });

	const { ok, error } = await FactionEngine.setRank(faction, interaction.user.id, target.id, newRank);
	if (!ok) return interaction.editReply({ content: error });

	return interaction.editReply({ content: `✅ **${target.username}** is now a **${newRank}** in ${faction.name}.` });
}

// ═══════════════════════════════════════════════════════════════════════════════
// /faction leaderboard
// ═══════════════════════════════════════════════════════════════════════════════
async function handleLeaderboard(interaction) {
	await interaction.deferReply();
	const factions = await Faction.find({ guildId: interaction.guildId }).sort({ powerScore: -1 }).limit(10).lean();
	if (!factions.length) return interaction.editReply({ content: "No factions yet! Use `/faction create` to start." });

	const embed = buildLeaderboardEmbed(factions);
	return interaction.editReply({ embeds: [embed] });
}

// ─── Build war action rows ────────────────────────────────────────────────────
function _buildWarActionRows(war, factionId) {
	const rows = [];

	if (war.phase === "preparation") {
		rows.push(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`B_WAR_ROSTER_${war._id}`).setLabel("✋ Join Roster").setStyle(ButtonStyle.Primary),
			),
		);
	}

	if (war.phase === "relay") {
		rows.push(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`B_WAR_RELAY_${war._id}`).setLabel("⚔️ Next Round").setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId(`B_WAR_STATUS_${war._id}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
			),
		);
	}

	if (war.phase === "siege") {
		const { side } = war.getTeam ? war.getTeam(factionId) : { side: null };
		const attackerSide = war.alphaScore >= war.betaScore ? "alpha" : "beta";
		rows.push(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`B_WAR_SIEGE_${war._id}`)
					.setLabel("🏹 Attack Siege (5 ⚡)")
					.setStyle(ButtonStyle.Danger)
					.setDisabled(side !== attackerSide),
				new ButtonBuilder().setCustomId(`B_WAR_STATUS_${war._id}`).setLabel("🔄 Refresh").setStyle(ButtonStyle.Secondary),
			),
		);
	}

	return rows;
}
