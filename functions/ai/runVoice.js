const { useHooks } = require("zihooks");

module.exports.data = {
	name: "runVoiceAI",
	type: "ai",
};

let voiceAI = false; // Đặt mặc định là `false`

module.exports.execute = async (interaction, lang, options = { query: null }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	try {
		const { client, guild, user } = interaction;

		const voiceChannel = interaction.member?.voice.channel;
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
			return interaction.reply({
				content: lang?.music?.NoPermission ?? "Bot không có quyền tham gia hoặc nói trong kênh thoại này",
				ephemeral: true,
			});
		}

		// Tham gia voice channel
		const tts = useHooks.get("functions").get("TextToSpeech");
		const result = options?.query ?? useHooks.get("ai").run(`Hello, my name is ${user.username}`);
		await tts.execute(interaction, result, lang);

		voiceAI = true;

		await interaction.editReply("✅ Successfully activated AI assistant!");
	} catch (error) {
		console.error("Error while joining the voice channel:", error);
		await interaction.editReply("❌ Failed to activate AI assistant. Please try again.");
	}
};

module.exports.checkStatus = () => {
	return voiceAI;
};
