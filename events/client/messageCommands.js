const { Client, Events, Message, PermissionsBitField, MessageFlags, EmbedBuilder } = require("discord.js");
const { useHooks, modinteraction } = require("zihooks");
const fs = require("fs");
const path = require("path");
const Cooldowns = useHooks.get("cooldowns");
const Commands = useHooks.get("Mcommands");
const Functions = useHooks.get("functions");
const config = useHooks.get("config");
const { getPlayer } = require("ziplayer");

const ziicon = require("./../../utility/icon");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

/**
 *
 * @param { import("zihooks").CommandInteraction } message
 * @param { Client } client
 * @param { import("./../../lang/vi.js") } lang
 * @returns
 */
async function checkStatus(message, client, lang) {
	// Check permission
	if (message.guild) {
		const hasPermission = message.channel
			.permissionsFor(client.user)
			.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);

		if (!hasPermission) {
			await message.reply({ content: lang.until.NOPermission, ephemeral: true });
			return true;
		}
	}
	// Check banned
	const configPath = path.join(__dirname, "../../jsons/developer.json");
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
	}
	let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
	if (devConfig.bannedUsers.includes(message.author.id)) {
		await message
			.reply({
				content: lang.until.banned,
				flags: MessageFlags.Ephemeral,
			})
			.catch(() => {});
		return true;
	}

	// Check owner
	if (config.OwnerID.includes(message.author.id)) return false;

	// Check cooldown
	const now = Date.now();
	const cooldownDuration = config.defaultCooldownDuration ?? 3000;
	const expirationTime = Cooldowns.get(message.author.id) + cooldownDuration;

	if (Cooldowns.has(message.author.id) && now < expirationTime) {
		const expiredTimestamp = Math.round(expirationTime / 1_000);
		await message
			.reply({
				content: lang.until.cooldown
					.replace("{command}", message.commandName || message.customId)
					.replace("{time}", `<t:${expiredTimestamp}:R>`),
				ephemeral: true,
			})
			.catch(() => {});
		return true;
	}
	// Set cooldown
	Cooldowns.set(message.author.id, now);
	setTimeout(() => Cooldowns.delete(message.author.id), cooldownDuration);
	return false;
}

/**
 * @param { object } fns
 * @param { Message } fns.message
 * @param { object } fns.command
 * @param { import("./../../lang/vi.js") } fns.lang
 */
async function checkMusicstat({ message, command, lang }) {
	let ops = {
		status: false,
	};

	if (!message?.guild) {
		await message.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription(`${lang.until.noGuild} `)] });
		return ops;
	}
	const player = getPlayer(message.guild.id);
	ops.player = player;
	if (command?.lock) {
		if (!player?.connection) {
			await message.reply({ content: lang.music.NoPlaying, ephemeral: true });
			return ops;
		}
		// Kiểm tra xem có khóa player không
		if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== message.author?.id) {
			await message.reply({ content: lang.until.noPermission, ephemeral: true });
			return ops;
		}
	}
	if (command?.ckeckVoice) {
		const botVoiceChannel = message.guild.members.me.voice.channel;
		const userVoiceChannel = message.member.voice.channel;
		if (!botVoiceChannel || botVoiceChannel.id !== userVoiceChannel?.id) {
			await message.reply({ content: lang.music.NOvoiceMe, ephemeral: true });
			return ops;
		}
	}
	ops.status = true;
	return ops;
}

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
	if (!message.client.isReady()) return;

	if (message.author.bot) return;

	const prefix = config?.prefix || "zz";

	if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = Commands.get(args.shift().toLowerCase());

	if (!command) return;
	// Get the user's language preference
	const langfunc = Functions.get("ZiRank");

	const lang = await langfunc.execute({ user: message.author, XpADD: 1 });

	modinteraction(message);

	const commandStatus = await checkStatus(message, message.client, lang);

	if (commandStatus) return;
	if (command.data?.default_member_permissions && command.data.default_member_permissions === "0") {
		//check member
		if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
			return message.reply({ content: lang.until.noPermission, ephemeral: true });
		}
	}

	try {
		useHooks
			.get("logger")
			.debug(
				`Messenger received: ${command.data.name} >> User: ${message.author?.username} >> Guild: ${message?.guild?.name} (${message?.guildId})`,
			);

		let cmdops = null;
		if (command?.data.category == "musix") {
			const sts = await checkMusicstat({ message, command, lang });
			if (!sts.status) return;
			cmdops = sts;
		}
		await command.run({ message, args, lang, ...cmdops });
	} catch (error) {
		console.error(`Error executing message command ${command.data.name}:`, error);
	}
};
