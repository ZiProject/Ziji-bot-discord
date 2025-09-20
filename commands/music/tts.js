const { useFunctions } = require("@zibot/zihooks");
const Functions = useFunctions();

module.exports.data = {
	name: "tts",
	description: "Thay mặt bạn nói điều gì đó",
	type: 1, // slash command
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { client, guild, user, options } = interaction;

	await interaction.deferReply({ withResponse: true }).catch((e) => {});
	//channel:
	const voiceChannel = interaction.member.voice.channel;
	if (!voiceChannel) {
		return interaction.editReply({
			content: lang?.music?.NOvoiceChannel ?? "Bạn chưa tham gia vào kênh thoại",
			ephemeral: true,
		});
	}

	const voiceMe = guild.members.cache.get(client.user.id).voice.channel;
	if (voiceMe && voiceMe.id !== voiceChannel.id) {
		return interaction.editReply({
			content: lang?.music?.NOvoiceMe ?? "Bot đã tham gia một kênh thoại khác",
			ephemeral: true,
		});
	}

	const permissions = voiceChannel.permissionsFor(client.user);
	if (!permissions.has("Connect") || !permissions.has("Speak")) {
		return interaction.editReply({
			content: lang?.music?.NoPermission ?? "Bot không có quyền tham gia hoặc nói trong kênh thoại này",
			ephemeral: true,
		});
	}

	const context = options.getString("context");

	const oldthread = interaction.channel.threads.cache.find((x) => x.name === `${client.user.username} TTS | ${user.username}`);
	await oldthread?.setArchived(true);
	const thread = await interaction.channel.threads.create({
		name: `${client.user.username} TTS | ${user.username}`,
		autoArchiveDuration: 60,
		reason: `TTS command by ${user.tag}`,
	});

	Msg = await thread.send({
		content: `🎤 **TTS Started**  
		🔊 Voice Channel: ${voiceChannel.name}  
		👤 User: ${user.tag}  
		💬 Context: ${context}`,
	});

	await interaction.editReply({
		content: lang?.ttscreate.replace("{thread}", `${thread}`) ?? `✅ | Đã tạo kênh thoại TTS: ${thread}`,
	});

	await thread.members.add(user.id).catch(() => {});
	return;
};
