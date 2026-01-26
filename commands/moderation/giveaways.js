const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const Giveaways = useHooks.get("giveaways");
const config = useHooks.get("config");

const ms = require("ms");

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
		return interaction.reply({ content: lang.until.noPermission, ephemeral: true });
	}

	if (!Giveaways) {
		return interaction.reply({
			content: ":x: | Giveaway Manager is not initialized! Please check your config.",
			ephemeral: true,
		});
	}

	const commandtype = interaction.options?.getSubcommand();

	switch (commandtype) {
		case "start":
			return this.startGiveaway({ interaction, lang });
		case "end":
			return this.endGiveaway({ interaction, lang });
		case "reroll":
			return this.rerollGiveaway({ interaction, lang });
		case "pause":
			return this.pauseGiveaway({ interaction, lang });
		case "resume":
			return this.resumeGiveaway({ interaction, lang });
		case "delete":
			return this.deleteGiveaway({ interaction, lang });
		case "list":
			return this.listGiveaways({ interaction, lang });
		default:
			return interaction.reply({ content: lang?.until?.notHavePremission, ephemeral: true });
	}
	return;
};

module.exports.startGiveaway = async ({ interaction, lang }) => {
	const duration = interaction.options.getString("duration");
	const winnerCount = interaction.options.getInteger("winners");
	const prize = interaction.options.getString("prize");
	const channel = interaction.options.getChannel("channel") || interaction.channel;

	if (!channel.isTextBased()) {
		return interaction.reply({ content: lang?.Giveaways?.notTextChannel, ephemeral: true });
	}

	await Giveaways.start(channel, {
		duration: ms(duration),
		winnerCount,
		prize,
		hostedBy: interaction.user,
		thumbnail: interaction.user.displayAvatarURL(),
		messages: {
			giveaway: lang?.Giveaways?.giveaway,
			giveawayEnded: lang?.Giveaways?.giveawayEnded,
			title: lang?.Giveaways?.title,
			drawing: lang?.Giveaways?.drawing,
			inviteToParticipate: lang?.Giveaways?.inviteToParticipate,
			hostedBy: lang?.Giveaways?.hostedBy,
			dropMessage: lang?.Giveaways?.dropMessage,
			winMessage: lang?.Giveaways?.winMessage,
			embedFooter: lang?.Giveaways?.embedFooter,
			noWinner: lang?.Giveaways?.noWinner,
			winners: lang?.Giveaways?.winners,
			endedAt: lang?.Giveaways?.endedAt,
		},
	});
	return interaction.reply({ content: `${lang?.Giveaways?.notify} ${channel}`, ephemeral: true });
};

module.exports.endGiveaway = async ({ interaction, lang }) => {
	const messageId = interaction.options.getString("message");
	await Giveaways.end(messageId);
	return interaction.reply({ content: lang?.until?.success, ephemeral: true });
};

module.exports.rerollGiveaway = async ({ interaction, lang }) => {
	const messageId = interaction.options.getString("message");
	await Giveaways.reroll(messageId, {
		messages: {
			congrat: lang?.Giveaways?.winMessage,
			error: lang?.Giveaways?.noWinner,
		},
	});
	return interaction.reply({ content: lang?.until?.success, ephemeral: true });
};

module.exports.pauseGiveaway = async ({ interaction, lang }) => {
	const messageId = interaction.options.getString("message");
	await Giveaways.pause(messageId, {
		content: lang?.Giveaways?.giveawayPaused,
	});
	return interaction.reply({ content: lang?.until?.success, ephemeral: true });
};

module.exports.resumeGiveaway = async ({ interaction, lang }) => {
	const messageId = interaction.options.getString("message");
	await Giveaways.unpause(messageId);
	return interaction.reply({ content: lang?.until?.success, ephemeral: true });
};

module.exports.deleteGiveaway = async ({ interaction, lang }) => {
	const messageId = interaction.options.getString("message");
	await Giveaways.delete(messageId);
	return interaction.reply({ content: lang?.until?.success, ephemeral: true });
};

module.exports.listGiveaways = async ({ interaction, lang }) => {
	const giveaways = await Giveaways.getAllGiveaways();
	const guildGiveaways = giveaways.filter((giveaway) => giveaway.guildId === interaction.guild.id);
	const embed = new EmbedBuilder()
		.setDescription(
			guildGiveaways
				.map(
					(giveaway) =>
						`**${giveaway.messageId}**\n ${giveaway.prize}\n ${giveaway.hostedBy} <t:${Math.floor(giveaway.endAt / 1000)}:R>\n`,
				)
				.join("\n"),
		)
		.setColor(lang?.color || "Random");
	return interaction.reply({ embeds: [embed], ephemeral: true });
};

module.exports.data = {
	name: "giveaways",
	description: "Giveaways",
	type: 1, // slash commmand
	options: [
		{
			name: "start",
			description: "Bắt đầu một giveaway",
			type: 1, // sub command
			options: [
				{
					name: "duration",
					description: "Thời gian của giveaway",
					type: 3,
					required: true,
				},
				{
					name: "winners",
					description: "Số người thắng",
					type: 4,
					required: true,
				},
				{
					name: "prize",
					description: "Phần thưởng của giveaway",
					type: 3,
					required: true,
				},
				{
					name: "channel",
					description: "Kênh diễn ra giveaway",
					type: 7,
					channel_types: [0],
					required: false,
				},
			],
		},
		{
			name: "end",
			description: "Kết thúc một giveaway",
			type: 1,
			options: [
				{
					name: "message",
					description: "ID tin nhắn của giveaway",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "reroll",
			description: "Reroll một giveaway",
			type: 1, // sub command
			options: [
				{
					name: "message",
					description: "ID tin nhắn của giveaway",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "pause",
			description: "Tạm dừng một giveaway",
			type: 1,
			options: [
				{
					name: "message",
					description: "ID tin nhắn của giveaway",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "resume",
			description: "Tiếp tục một giveaway đã tạm dừng",
			type: 1,
			options: [
				{
					name: "message",
					description: "ID tin nhắn của giveaway",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "delete",
			description: "Xóa một giveaway",
			type: 1,
			options: [
				{
					name: "message",
					description: "ID tin nhắn của giveaway",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "list",
			description: "Danh sách các giveaway",
			type: 1,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "0", // chỉ có admin mới dùng được
	enable: config.DevConfig.Giveaway,
};
