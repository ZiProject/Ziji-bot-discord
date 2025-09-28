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

const { default: axios } = require("axios");
const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "mc-server",
	description: "Check status of minecraft server",
	type: 1, // slash command
	options: [
		{
			name: "ip",
			description: "The IP of minecraft server includes port",
			type: 3,
			required: true,
		},
		{
			name: "bedrock",
			description: "Is this server bedrock?",
			type: 5,
			required: true,
		},
		{
			name: "name",
			description: "Name of this minecraft server",
			type: 3,
			required: false,
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	const ip = interaction.options.getString("ip");
	const bedrock = interaction.options.getBoolean("bedrock");
	const request = bedrock ? `https://api.mcsrvstat.us/bedrock/3/${ip}` : `https://api.mcsrvstat.us/3/${ip}`;
	const { data: res } = await axios.get(request, {
		headers: {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3",
		},
	});
	const name = interaction.options.getString("name") || "A Minecraft Server";
	const onlineEmbed = new EmbedBuilder()
		.setAuthor({ name, iconURL: `https://api.mcsrvstat.us/icon/${ip}` })
		.addFields(
			{ name: "Resolved IP", value: `\`${res.ip}:${res.port}\``, inline: true },
			{ name: "Players Count", value: `${res.players.online} / ${res.players.max}`, inline: true },
			{ name: "Version", value: res.version, inline: true },
			{ name: "Software", value: `\`${res.software || "⚠ Unknown"}\``, inline: true },
		)
		.setColor("Green")
		.setImage(`https://api.loohpjames.com/serverbanner.png?ip=${ip}&name=${encodeURIComponent(name)}`)
		.setTimestamp()
		.setFooter({ text: `${interaction.client.user.username} • ${ip}`, iconURL: interaction.client.user.displayAvatarURL() });
	const offlineEmbed = new EmbedBuilder()
		.setAuthor({ name, iconURL: `https://api.mcsrvstat.us/icon/${ip}` })
		.addFields(
			{ name: "Resolved IP", value: `\`${res.ip || "⚠ Unknown"}\``, inline: true },
			{ name: "Players Count", value: `0 / 0`, inline: true },
			{ name: "Version", value: res.version || "⚠ Unknown", inline: true },
		)
		.setColor("Red")
		.setImage(`https://api.loohpjames.com/serverbanner.png?ip=${ip}&name=${encodeURIComponent(name)}`)
		.setTimestamp()
		.setFooter({ text: `${interaction.client.user.username} • ${ip}`, iconURL: interaction.client.user.displayAvatarURL() });
	await interaction.editReply({ embeds: [res?.online ? onlineEmbed : offlineEmbed] });
};
