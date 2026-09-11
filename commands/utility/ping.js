const { default: axios } = require("axios");
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { EmbedBuilder } = require("discord.js");
const config = require("zihooks").useHooks.get("config");

module.exports.data = {
	name: "ping",
	description: "Check the bot's ping",
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
	try {
		// InteractionCreate already ACKs this command with deferReply().
		// Do not call reply() here: editReply() updates the deferred response.
		await interaction.editReply({ content: "🏓 Pinging..." });
		const roundTripLatency = Date.now() - interaction.createdTimestamp;
		const botPing = interaction.client.ws.ping;
		const req = await axios.get(`http://127.0.0.1:${process.env.SERVER_PORT || 2003}`);
		const webPing = req.data.status;
		const latencyStatus =
			botPing > 200 ? lang?.Ping?.Poor || " "
			: botPing > 100 ? lang?.Ping?.Good || " "
			: lang?.Ping?.Excellent || " ";

		const informationEmbed = new EmbedBuilder()
			.setTitle("🏓 Pong!")
			.setColor(lang?.color || "Random")
			.setDescription(lang.Ping?.Description?.replace("##username##", interaction.user) || " ")
			.addFields(
				{ name: lang?.Ping?.Roundtrip || " ", value: `${roundTripLatency}ms`, inline: true },
				{ name: lang?.Ping?.Websocket || " ", value: `${botPing}ms`, inline: true },
				{ name: "🌏 Web Control", value: `${webPing === "OK" ? "🟢 Working" : "🔴 Offline"}`, inline: true },
				{ name: lang?.Ping?.Latency || " ", value: latencyStatus, inline: true },
				{
					name: lang?.Ping?.Timestamp || " ",
					value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
					inline: true,
				},
			)
			.setImage(config.botConfig?.Banner || null)
			.setThumbnail(interaction.client.user.displayAvatarURL({ size: 1024, dynamic: true }))
			.setTimestamp()
			.setFooter({
				text: `${lang.until.requestBy} ${interaction.user.username}`,
				iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
			});

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
			await interaction.editReply({ content: null, embeds: [informationEmbed], components: [row] });
			return;
		}
		await interaction.editReply({ content: null, embeds: [informationEmbed] });
	} catch (error) {
		console.error("Error executing ping command:", error);
		if (interaction.deferred || interaction.replied) {
			await interaction
				.editReply({
					content: "❌ There was an error executing the ping command.",
					embeds: [],
					components: [],
				})
				.catch(() => {});
		} else {
			await interaction
				.reply({
					content: "❌ There was an error executing the ping command.",
					ephemeral: true,
				})
				.catch(() => {});
		}
	}
};
