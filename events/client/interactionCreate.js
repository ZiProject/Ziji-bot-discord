const { Events, CommandInteraction, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const fs = require("fs");
const path = require("path");
const Cooldowns = useHooks.get("cooldowns");
const Commands = useHooks.get("commands");
const Functions = useHooks.get("functions");
const { getPlayer } = require("ziplayer");

async function checkStatus(interaction, client, lang) {
	if (interaction.guild) {
		const hasPermission = interaction.channel
			.permissionsFor(client.user)
			.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);

		if (!hasPermission) {
			const response = { content: lang.until.NOPermission, ephemeral: true };
			if (interaction.deferred || interaction.replied) await interaction.editReply(response);
			else await interaction.reply(response);
			return true;
		}
	}

	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	const devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
	if (devConfig.bannedUsers.includes(interaction.user.id)) {
		const response = { content: lang.until.banned, flags: MessageFlags.Ephemeral };
		if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
		else await interaction.reply(response).catch(() => {});
		return true;
	}

	if (config.OwnerID.includes(interaction.user.id)) return false;
	if (interaction.isModalSubmit()) return false;

	const now = Date.now();
	const cooldownDuration = config.defaultCooldownDuration ?? 3000;
	const expirationTime = Cooldowns.get(interaction.user.id) + cooldownDuration;
	if (Cooldowns.has(interaction.user.id) && now < expirationTime) {
		const expiredTimestamp = Math.round(expirationTime / 1_000);
		const response = {
			content: lang.until.cooldown
				.replace("{command}", interaction.commandName || interaction.customId)
				.replace("{time}", `<t:${expiredTimestamp}:R>`),
			ephemeral: true,
		};
		if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
		else await interaction.reply(response).catch(() => {});
		return true;
	}

	Cooldowns.set(interaction.user.id, now);
	setTimeout(() => Cooldowns.delete(interaction.user.id), cooldownDuration);
	return false;
}

async function checkMusicstat({ interaction, command, lang }) {
	const ops = { status: false };
	if (!interaction?.guild) {
		const response = { embeds: [new EmbedBuilder().setColor("Red").setDescription(`${lang.until.noGuild} `)] };
		if (interaction.deferred || interaction.replied) await interaction.editReply(response);
		else await interaction.reply(response);
		return ops;
	}

	const voiceChannel = interaction.member?.voice?.channel;
	const player = getPlayer(`${interaction.guild.id}::${voiceChannel?.id}`);
	ops.player = player;

	if (command.data?.lock) {
		if (!player?.connection) {
			const response = { content: lang.music.NoPlaying, ephemeral: true };
			if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
			else await interaction.reply(response).catch(() => {});
			return ops;
		}
		if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id) {
			const response = { content: lang.until.noPermission, ephemeral: true };
			if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
			else await interaction.reply(response).catch(() => {});
			return ops;
		}
	}

	if (command.data?.ckeckVoice) {
		const userVoiceChannel = interaction.member.voice.channel;
		if (!userVoiceChannel) {
			const response = { content: lang.music.NOvoiceMe, ephemeral: true };
			if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
			else await interaction.reply(response).catch(() => {});
			return ops;
		}
	}

	ops.status = true;
	return ops;
}

module.exports = { name: Events.InteractionCreate, type: "events" };

// Commands that historically selected an ephemeral initial ACK. The value is
// resolved here because Discord fixes ephemeral/public visibility at defer time.
const EPHEMERAL_COMMANDS = new Set(["afk", "jtc", "encrypt", "decrypt", "listservers", "youtube", "noitu"]);

async function getAckOptions(command, interaction) {
	const value = command?.data?.ephemeral;
	let ephemeral = typeof value === "function" ? await value(interaction) : value === true;

	if (!ephemeral && EPHEMERAL_COMMANDS.has(interaction.commandName)) ephemeral = true;

	// These commands only defer ephemerally for specific subcommands.
	if (interaction.commandName === "genshin") {
		ephemeral = ephemeral || interaction.options?.getSubcommand?.(false) === "claim";
	}
	if (interaction.commandName === "confession") {
		ephemeral = ephemeral || interaction.options?.getSubcommand?.(false) === "write";
	}
	if (interaction.commandName === "guildcommand") {
		const subcommand = interaction.options?.getSubcommand?.(false);
		ephemeral = ephemeral || subcommand === "create" || subcommand === "list";
	}

	return ephemeral ? { flags: MessageFlags.Ephemeral } : undefined;
}

module.exports.execute = async (interaction) => {
	const { client, user } = interaction;
	if (!client.isReady()) return;

	let command;
	let commandType;
	let cmdops = null;
	const logger = useHooks.get("logger");

	if (interaction.isChatInputCommand() || interaction.isAutocomplete() || interaction.isMessageContextMenuCommand()) {
		command = Commands.get(interaction.commandName);
		if (!command && interaction.guildId)
			command = useHooks.get("guildCommands")?.get(`${interaction.guildId}:${interaction.commandName.toLowerCase()}`);
		commandType = "command";
	} else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
		command = Functions.get(interaction.customId);
		commandType = "function";
	}

	if (!command) {
		logger.debug(`No ${commandType} matching ${interaction.commandName || interaction.customId} was found.`);
		return;
	}

	const shouldDefer = interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand();
	if (shouldDefer && !interaction.deferred && !interaction.replied) {
		await interaction.deferReply(await getAckOptions(command, interaction));

		// Compatibility contract for legacy command modules: the dispatcher owns
		// the initial ACK, commands only edit that response afterwards.
		interaction.reply = async (options) => interaction.editReply(options);
		interaction.deferReply = async () => interaction;
	}

	const langfunc = Functions.get("ZiRank");
	const lang = await langfunc.execute({ user, XpADD: interaction.isAutocomplete() ? 0 : 1 });

	try {
		if (interaction.isAutocomplete()) {
			await command?.autocomplete({ interaction, lang });
		} else {
			logger.debug(
				`Interaction received: ${interaction?.commandName || interaction?.customId} >> User: ${interaction?.user?.username} >> Guild: ${interaction?.guild?.name} (${interaction?.guildId})`,
			);

			const status = await checkStatus(interaction, client, lang);
			logger.debug(`Status check for ${interaction?.commandName || interaction?.customId}: ${status ? "Failed" : "Passed"}`);
			if (status) return;

			if (command?.data.category == "musix") {
				const sts = await checkMusicstat({ interaction, command, lang });
				logger.debug(
					`Music status check for ${interaction?.commandName || interaction?.customId}: ${sts.status ? "Passed" : "Failed"}`,
				);
				if (!sts.status) return;
				cmdops = sts;
			}
			await command.execute({ interaction, lang, ...cmdops });
		}
	} catch (error) {
		client.errorLog(`**${error.message}**`);
		client.errorLog(error.stack);
		console.error(error);
		const response = { content: "There was an error while executing this command!", ephemeral: true };
		if (interaction.isAutocomplete()) return;
		if (interaction.replied || interaction.deferred) await interaction.editReply(response).catch(() => {});
		else await interaction.reply(response).catch(() => {});
	}
};
