const { Events, CommandInteraction, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const config = useHooks.get("config");
const fs = require("fs");
const path = require("path");
const Cooldowns = useHooks.get("cooldowns");
const Commands = useHooks.get("commands");
const Functions = useHooks.get("functions");
const { getPlayer } = require("ziplayer");

/**
 * @param { CommandInteraction } interaction
 * @param { Client } client
 * @param { import('../../lang/vi.js') } lang - language
 */

async function checkStatus(interaction, client, lang) {
	// Check permission
	if (interaction.guild) {
		const hasPermission = interaction.channel
			.permissionsFor(client.user)
			.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);

		if (!hasPermission) {
			await interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
			return true;
		}
	}
	// Check banned
	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	}
	let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
	if (devConfig.bannedUsers.includes(interaction.user.id)) {
		await interaction
			.reply({
				content: lang.until.banned,
				flags: MessageFlags.Ephemeral,
			})
			.catch(() => {});
		return true;
	}

	// Check owner
	if (config.OwnerID.includes(interaction.user.id)) return false;

	// Check modal
	if (interaction.isModalSubmit()) return false;
	// Check cooldown
	const now = Date.now();
	const cooldownDuration = config.defaultCooldownDuration ?? 3000;
	const expirationTime = Cooldowns.get(interaction.user.id) + cooldownDuration;

	if (Cooldowns.has(interaction.user.id) && now < expirationTime) {
		const expiredTimestamp = Math.round(expirationTime / 1_000);
		await interaction
			.reply({
				content: lang.until.cooldown
					.replace("{command}", interaction.commandName || interaction.customId)
					.replace("{time}", `<t:${expiredTimestamp}:R>`),
				ephemeral: true,
			})
			.catch(() => {});
		return true;
	}
	// Set cooldown
	Cooldowns.set(interaction.user.id, now);
	setTimeout(() => Cooldowns.delete(interaction.user.id), cooldownDuration);
	return false;
}
/**
 * @param { object } fns
 * @param { CommandInteraction } fns.interaction
 * @param { object } fns.command
 * @param { import("./../../lang/vi.js") } fns.lang
 */
async function checkMusicstat({ interaction, command, lang }) {
	let ops = {
		status: false,
	};
	if (!interaction?.guild) {
		await interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription(`${lang.until.noGuild} `)] });
		return ops;
	}
	const player = getPlayer(interaction.guild.id);
	ops.player = player;
	if (command?.lock) {
		if (!player?.connection) {
			await interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });
			return ops;
		}
		// Kiểm tra xem có khóa player không
		if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id) {
			await interaction.followUp({ content: lang.until.noPermission, ephemeral: true });
			return ops;
		}
	}
	if (command?.ckeckVoice) {
		const botVoiceChannel = interaction.guild.members.me.voice.channel;
		const userVoiceChannel = interaction.member.voice.channel;
		if (!botVoiceChannel || botVoiceChannel.id !== userVoiceChannel?.id) {
			await interaction.followUp({ content: lang.music.NOvoiceMe, ephemeral: true });
			return ops;
		}
	}
	ops.status = true;
	return ops;
}

module.exports = {
	name: Events.InteractionCreate,
	type: "events",
};

/**
 * @param { CommandInteraction } interaction
 */
module.exports.execute = async (interaction) => {
	const { client, user } = interaction;
	if (!client.isReady()) return;

	let command;
	let commandType;
	let cmdops = null;
	const logger = useHooks.get("logger");

	// Determine the interaction type and set the command
	if (interaction.isChatInputCommand() || interaction.isAutocomplete() || interaction.isMessageContextMenuCommand()) {
		command = Commands.get(interaction.commandName);
		commandType = "command";
	} else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
		command = Functions.get(interaction.customId);
		commandType = "function";
	}

	// If no command was found, log the error and return
	if (!command) {
		logger.debug(`No ${commandType} matching ${interaction.commandName || interaction.customId} was found.`);
		return;
	}

	// Get the user's language preference
	const langfunc = Functions.get("ZiRank");
	const lang = await langfunc.execute({ user, XpADD: interaction.isAutocomplete() ? 0 : 1 });

	// Try to execute the command and handle errors
	try {
		if (interaction.isAutocomplete()) {
			await command?.autocomplete({ interaction, lang });
		} else {
			logger.debug(
				`Interaction received: ${interaction?.commandName || interaction?.customId} >> User: ${interaction?.user?.username} >> Guild: ${interaction?.guild?.name} (${interaction?.guildId})`,
			);

			const status = await checkStatus(interaction, client, lang);
			if (status) return;

			if (command?.data.category == "musix") {
				const sts = await checkMusicstat({ interaction, command, lang });
				if (!sts.status) return;
				cmdops = sts;
			}
			await command.execute({ interaction, lang, ...cmdops });
		}
	} catch (error) {
		client.errorLog(`**${error.message}**`);
		client.errorLog(error.stack);
		console.error(error);
		const response = {
			content: "There was an error while executing this command!",
			ephemeral: true,
		};
		if (interaction.isAutocomplete()) return;
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(response).catch(() => {});
		} else {
			await interaction.reply(response).catch(() => {});
		}
	}
};
