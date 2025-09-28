/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ZiIcons = require("../../utility/icon");
// Config will be available through this.config in bound context

module.exports.data = {
	name: "help",
	description: "Help",
	type: 1, // slash command
	options: [],
	integration_types: [0],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } lang
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const embed = new EmbedBuilder()
		.setAuthor({
			name: `${interaction.client.user.username} Help:`,
			iconURL: interaction.client.user.displayAvatarURL({ size: 1024 }),
		})
		.setDescription(lang.Help.Placeholder)
		.setColor(lang?.color || "Random")
		.setImage(config.botConfig?.Banner || null)
		.setFooter({
			text: `${lang.until.requestBy} ${interaction.user?.username}`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("S_Help")
		.setPlaceholder(lang.Help.Placeholder)
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions([
			{
				emoji: "<:section:1254203682686373938>",
				label: lang.Help.GuildCommands,
				value: "guild_commands",
				description: lang.Help.GuildCommandsDescription || "Xem danh sách các lệnh có thể sử dụng trong server",
			},
			{
				emoji: "<:zi_user:1253090627923611709>",
				label: lang.Help.ContextCommands,
				value: "context_commands",
				description: lang.Help.ContextCommandsDescription || "Xem danh sách các lệnh có thể sử dụng trong context menu",
			},
			{
				emoji: "<:zi_music:1253090631668994132>",
				label: lang.Help.PlayerButtons,
				value: "player_buttons",
				description: lang.Help.PlayerButtonsDescription || "Xem danh sách các button có thể sử dụng trong music player",
			},
			{
				emoji: "<:zi_voice:1253090469328453733>",
				label: lang.Help.VoiceCommands,
				value: "voice_commands",
				description: lang.Help.VoiceCommandsDescription || "Xem danh sách các lệnh có thể sử dụng bằng giọng nói",
			},
		]);

	const row = new ActionRowBuilder().addComponents(selectMenu);

	const row2 = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setLabel("Support Server")
			.setStyle(ButtonStyle.Link)
			.setEmoji(ZiIcons.fillter)
			.setURL(config.botConfig?.SupportServer || "https://discord.gg/bkBejRNcR3"),
		new ButtonBuilder()
			.setLabel("Invite Bot")
			.setStyle(ButtonStyle.Link)
			.setEmoji(ZiIcons.fillter)
			.setURL(config.botConfig?.InviteBot || `https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}`),
	);

	await interaction.editReply({
		embeds: [embed],
		components: [row, row2],
		fetchReply: true,
	});
	return;
};
