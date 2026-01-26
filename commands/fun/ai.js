const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");
const config = useHooks.get("config");

module.exports.data = {
	name: "ai",
	description: "Tính năng AI",
	type: 1, // slash command
	options: [
		{
			name: "ask",
			description: "Hỏi AI",
			type: 1,
			options: [
				{
					name: "prompt",
					description: "Tin nhắn để gửi",
					type: 3,
					required: true,
				},
			],
		},
		{
			name: "assistant",
			description: "Kích hoạt AI trong phòng voice",
			type: 1,
			options: [
				{
					name: "focus",
					description: "Chỉ nghe lệnh người yêu cầu.",
					type: 5, //BOOLEAN
				},
			],
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1],
	enable: config.DevConfig.ai,
};

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
	await interaction.deferReply();

	const { client, guild, options, member } = interaction;
	const subcommand = options.getSubcommand();
	const prompt = options.getString("prompt") || "Hello";
	const player = guild?.id ? getPlayer(guild.id) : null;

	/**
	 * Nếu có voice, ưu tiên vào voice trả lời.
	 * Nếu Không có thì trả lời messenger
	 */

	if (subcommand === "assistant") {
		// Handle assistant functionality
		return this.assistant(interaction, lang, { query: prompt });
	}

	if (!player) return this.ask(interaction, prompt, lang);

	const voiceChannel = member?.voice?.channel;
	if (!voiceChannel) {
		return this.ask(interaction, prompt, lang);
	}

	// Check if bot is in the same voice channel
	const botVoiceChannel = guild.members.cache.get(client.user.id)?.voice.channel;
	if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
		return this.ask(interaction, prompt, lang);
	}

	// Check permissions in the voice channel
	const permissions = voiceChannel.permissionsFor(client.user);
	if (!permissions?.has("Connect") || !permissions.has("Speak")) {
		return this.ask(interaction, prompt, lang);
	}

	// Handle assistant functionality
	return this.assistant(interaction, lang, { query: prompt });
};

module.exports.ask = async (interaction, prompt, lang) => {
	const runAI = useHooks.get("functions").get("runAI");
	await runAI.execute(interaction, prompt, lang);
};

module.exports.assistant = async (interaction, lang, { query: prompt }) => {
	const focus = interaction.options.getBoolean("focus") ? interaction.user.id : null;
	const runVoiceAI = useHooks.get("functions").get("runVoiceAI");
	await runVoiceAI.execute(interaction, lang, { query: prompt, focus });
};
