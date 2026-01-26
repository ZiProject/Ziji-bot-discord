const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ZiIcons = require("../../utility/icon");
const config = require("zihooks").useHooks.get("config");

function buildHelpMenu({ user, bot, lang }) {
	// This function can be expanded to build dynamic help menus if needed
	const embed = new EmbedBuilder()
		.setAuthor({
			name: `${bot.user.username} Help:`,
			iconURL: bot.user.displayAvatarURL({ size: 1024 }),
		})
		.setDescription(lang.Help.Placeholder)
		.setColor(lang?.color || "Random")
		.setImage(config.botConfig?.Banner || null)
		.setFooter({
			text: `${lang.until.requestBy} ${user?.username}`,
			iconURL: user.displayAvatarURL({ size: 1024 }),
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
				emoji: "<:section:1254203682686373938>",
				label: lang.Help.MessCommands,
				value: "msg_commands",
				description: lang.Help.MessCommandsDescription || "Xem danh sách các lệnh có thể sử dụng trong server",
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
	return (code = {
		embeds: [embed],
		components: [row, row2],
		fetchReply: true,
	});
}

module.exports.data = {
	name: "help",
	description: "Help",
	type: 1, // slash command
	options: [],
	integration_types: [0],
	contexts: [0, 1],
	alias: ["h"],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } lang
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();

	const menu = buildHelpMenu({ user: interaction.user, bot: interaction.client, lang });
	await interaction.editReply(menu);
	return;
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").Message } command.message - interaction
 * @param { import('../../lang/vi.js') } lang
 */
module.exports.run = async ({ message, lang }) => {
	const menu = buildHelpMenu({ user: message.author, bot: message.client, lang });
	await message.reply(menu);
	return;
};
