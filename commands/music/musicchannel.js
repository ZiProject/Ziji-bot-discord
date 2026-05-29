const { EmbedBuilder } = require("discord.js");
const { PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");
const { enable } = require("../../events/client/messageMusic.js");
/**
 * @type { import("../../config.js") } config
 */
const config = useHooks.get("config");

module.exports.data = {
	name: "musicchannel",
	description: "Thiết lập kênh nhạc cho bot",
	type: 1, // slash command
	options: [
		{
			name: "channel",
			description: "Kênh nhạc cần thiết lập",
			type: 7, // channel
			required: true,
		},
		{
			name: "enable",
			description: "Bật hoặc tắt kênh nhạc",
			type: 5, // boolean
			required: false,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0",
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	/**
	 * @type { import("discord.js").TextBasedChannel } channel
	 */
	const channel = interaction.options.getChannel("channel") || interaction.channel;
	const enableOption = interaction.options.getBoolean("enable");
	/**
	 * @type { import("mongoose").Schema } db
	 */
	const db = useHooks.get("db");

	if (!channel || channel.type !== 0) {
		return interaction.reply({ content: lang.music.invalid_channel, ephemeral: true });
	}

	if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
		return interaction.reply({ content: lang.music.missing_permissions, ephemeral: true });
	}

	if (enableOption === false) {
		useHooks.get("temp").delete(`music_channel_${interaction.guild.id}`);
		await db.ZiGuild.findOneAndUpdate({ guildId: interaction.guild.id }, { $unset: { music_channel: "" } });
		return interaction.reply({ content: lang.music.setup_channel_success.replace("{channel}", "None"), ephemeral: true });
	}

	useHooks.get("temp").set(`music_channel_${interaction.guild.id}`, channel.id);
	await db.ZiGuild.findOneAndUpdate({ guildId: interaction.guild.id }, { music_channel: channel.id }, { upsert: true });

	await interaction.channel.send({
		embeds: [
			new EmbedBuilder()
				.setTitle("Music Channel Info")
				.setDescription(lang.music.setup_channel_desc)
				.setColor(config.defaultColor)
				.setThumbnail(config.botConfig.Banner),
		],
	});

	const playerGui = useHooks.get("functions").get("playerGui");
	if (!playerGui) return;

	channel
		.send(
			await playerGui.execute({
				player: {
					volume: 999,
					repeatMode: "OFF",
					autoPlay: false,
					isPaused: true,
					isPlaying: false,
					queue: [],
					previousTrack: null,
					loop: () => {
						return false;
					},
					autoPlay: () => {
						return false;
					},
					getProgressBar: () => {
						return "▇▇▇▇▇▇▇▇▇▇";
					},
					relatedTracks: [],
					userdata: {
						lyrcsActive: false,
						LockStatus: true,
						requestedBy: interaction.client.user,
					},
				},
				tracks: {
					title: "Send messages in this channel to play music",
					requestedBy: interaction.client.user,
					thummail: config.botConfig.Banner,
					source: "youtube",
					url: "https://discord.com/oauth2/authorize?client_id=" + interaction.client.user.id,
				},
			}),
		)
		.catch(() => {});

	return interaction.reply({ content: lang.music.setup_channel_success.replace("{channel}", channel.name), ephemeral: true });
};
