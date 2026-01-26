const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const os = require("os");
const { version: DjsVersion } = require("discord.js");
const { execSync } = require("child_process");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "statistics",
	description: "View information about the system.",
	type: 1, // slash command
	options: [],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const config = useHooks.get("config");
	await interaction.deferReply();
	const { client } = interaction;

	const rowC = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId("B_cancel").setLabel("❌").setStyle(ButtonStyle.Secondary),
	);
	const osInfo = `${os.type()} ${os.release()} ${os.arch()}`;

	// Lấy GitHub Commit ID
	let githubCommitId = "N/A";
	try {
		githubCommitId = execSync("git rev-parse --short HEAD").toString().trim();
	} catch (error) {
		console.error("Không thể lấy GitHub Commit");
	}
	const onwerIDs = config?.OwnerID;

	const totalGuilds = client.guilds.cache.size;
	const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
	const voiceConnections = client?.voice?.adapters?.size || 0;

	// Tạo embed để hiển thị thông tin
	const embed = new EmbedBuilder()
		.setColor(lang?.color || "Random")
		.setDescription(
			`**${lang?.BotStats?.Description} ${client.user.username}:
          • Owner/Developer: ${onwerIDs.map((id) => `<@${id}>`).join(" ") || `<@891275176409460746>`}
          • ${lang?.BotStats?.User}: \`${totalMembers || 0}\`
          • ${lang?.BotStats?.Server}: \`${totalGuilds || 0}\`
          • ${lang?.BotStats?.Voice}: \`${voiceConnections}\`
          • ${lang?.BotStats?.Command}: \`${useHooks.get("commands").map((c) => c.data.name).length}\`
          • ${lang?.BotStats?.Operation}: <t:${Math.floor(Number(Date.now() - client.uptime) / 1000)}:R>
          • Ping: \`${client.ws.ping} MS\`
          • ${lang?.BotStats?.RAMUsage}: \`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\`
          [Invite Bot](${lang?.botConfig.InviteBot}) /  [Support Server](${lang?.botConfig.SupportServer})
          **`,
		)
		.addFields(
			{ name: lang?.BotStats?.OS, value: osInfo, inline: true },
			{ name: lang?.BotStats?.djsVersion, value: `${DjsVersion}`, inline: true },
			{ name: "GitHub Commit ID", value: githubCommitId, inline: true },
		)
		.setImage(lang?.botConfig?.Banner ?? null)
		.setThumbnail(interaction.client.user.displayAvatarURL())
		.setFooter({
			text: `${lang.until.requestBy} ${interaction.user.username}`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();

	if (config?.webAppConfig?.enabled) {
		const status = new ButtonBuilder()
			.setLabel("Status")
			.setEmoji("1254203682686373938")
			.setStyle(ButtonStyle.Link)
			.setURL(config.webAppConfig?.statusUrl);
		const music = new ButtonBuilder()
			.setLabel("Music Controller")
			.setEmoji("1254203682686373938")
			.setStyle(ButtonStyle.Link)
			.setURL(config.webAppConfig?.musicControllerUrl);
		const dashboard = new ButtonBuilder()
			.setLabel("Dashboard")
			.setEmoji("1254203682686373938")
			.setStyle(ButtonStyle.Link)
			.setURL(config.webAppConfig?.dashboardUrl);
		const row = new ActionRowBuilder().addComponents(status, music, dashboard);
		await interaction.editReply({ embeds: [embed], components: [row, rowC] });
		return;
	}
	// Gửi embed
	await interaction.editReply({ embeds: [embed], components: [rowC] });
};
