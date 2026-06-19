const { Events, Message } = require("discord.js");
const { modinteraction, useHooks } = require("zihooks");
const config = useHooks.get("config");
const mentionRegex = /@(everyone|here|ping)/;
const { getPlayer } = require("ziplayer");

const Commands = useHooks.get("commands");
const Functions = useHooks.get("functions");

function formatDuration(ms) {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));

	const parts = [];
	if (days > 0) parts.push(`${days} ngày`);
	if (hours > 0) parts.push(`${hours} giờ`);
	if (minutes > 0) parts.push(`${minutes} phút`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds} giây`);

	return parts.join(", ");
}

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: config?.DevConfig?.AutoResponder,
};

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
	if (!message.client.isReady()) return;
	if (message.author.bot) return;

	const db = useHooks.get("db");

	// Manage AFK
	const afkCache = useHooks.get("afkCache");
	if (afkCache) {
		// User returning from AFK
		const cachedUser = afkCache.get(message.author.id);
		if (cachedUser?.afk) {
			let shouldNotifyReturn = false;

			if (db) {
				try {
					await db.ZiUser.updateOne(
						{ userID: message.author.id },
						{ $set: { afk: false, afkReason: null, afkTime: null } },
					);
					shouldNotifyReturn = true;
				} catch (err) {
					useHooks.get("logger")?.error?.("Failed to update AFK status in database", err);
				}
			} else {
				shouldNotifyReturn = true;
			}

			if (shouldNotifyReturn) {
				afkCache.delete(message.author.id);

				const timeDiff = Date.now() - new Date(cachedUser.afkTime).getTime();
				const duration = formatDuration(timeDiff);
				message.reply(`Chào mừng bạn quay trở lại! Bạn đã vắng mặt trong **${duration}**.`).then((msg) => {
					setTimeout(() => msg.delete().catch(() => {}), 10000);
				});
			}
		}

		// Checking mentioned users for AFK
		if (message.mentions.users.size > 0) {
			message.mentions.users.forEach((user) => {
				if (user.id === message.author.id) return;
				const cachedMentioned = afkCache.get(user.id);
				if (cachedMentioned?.afk) {
					const timeDiff = Date.now() - new Date(cachedMentioned.afkTime).getTime();
					const duration = formatDuration(timeDiff);
					message.reply(
						`💤 **${user.username}** hiện đang AFK từ **${duration}** trước.\n**Lý do:** ${cachedMentioned.afkReason}`,
					);
				}
			});
		}
	} else if (db) {
		// Fallback if afkCache is not loaded/initialized
		const userData = await db.ZiUser.findOne({ userID: message.author.id });
		if (userData?.afk) {
			try {
				await db.ZiUser.updateOne(
					{ userID: message.author.id },
					{ $set: { afk: false, afkReason: null, afkTime: null } },
				);

				const timeDiff = Date.now() - new Date(userData.afkTime).getTime();
				const duration = formatDuration(timeDiff);
				message.reply(`Chào mừng bạn quay trở lại! Bạn đã vắng mặt trong **${duration}**.`).then((msg) => {
					setTimeout(() => msg.delete().catch(() => {}), 10000);
				});
			} catch (err) {
				useHooks.get("logger")?.error?.("Failed to update AFK status in database", err);
			}
		}

		// Checking mentioned users for AFK
		if (message.mentions.users.size > 0) {
			message.mentions.users.forEach(async (user) => {
				if (user.id === message.author.id) return;
				const mentionedUser = await db.ZiUser.findOne({ userID: user.id });
				if (mentionedUser?.afk) {
					const timeDiff = Date.now() - new Date(mentionedUser.afkTime).getTime();
					const duration = formatDuration(timeDiff);
					message.reply(`💤 **${user.username}** hiện đang AFK từ **${duration}** trước.\n**Lý do:** ${mentionedUser.afkReason}`);
				}
			});
		}
	}

	// Get the user's language preference

	//tts
	if (message.channel?.isThread?.() && message.channel?.name?.startsWith(`${message?.client?.user?.username} TTS |`)) {
		const langfunc = Functions.get("ZiRank");
		const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
		return await reqTTS(message, lang);
	}
	// Auto Responder
	if (config?.DevConfig?.AutoResponder && message?.guild && (await reqreponser(message))) return; // Auto Responder
	if (!message.guild || message.mentions.has(message.client.user)) {
		// DM channel auto reply = AI
		if (!config?.DevConfig?.ai || !process.env?.GEMINI_API_KEY?.length) return;
		const langfunc = Functions.get("ZiRank");
		const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
		await reqai(message, lang);
	}
};

/**
 * @param { Message } message
 */

const reqai = async (message, lang) => {
	if (mentionRegex.test(message.content?.toLowerCase())) return;
	const prompt = message.content.replace(`<@${message.client.user.id}>`, "").trim();
	if (!prompt) {
		const commsnd = Commands.get("help");
		if (commsnd) {
			modinteraction(message);
			await commsnd.execute({ interaction: message, lang });
		}
		return;
	}
	await message.channel.sendTyping().catch(() => {
		return; // khong the gui message nen bo qua
	});

	try {
		const result = await useHooks.get("ai").run(prompt, message.author, lang);
		await message.reply(result);
	} catch (err) {
		useHooks.get("logger")?.error?.(`Error in generating content: ${err}`);
	}
};

/**
 * @param { Message } message
 */

const reqreponser = async (message) => {
	const parseVar = Functions.get("getVariable");
	const guildResponders = useHooks.get("responder").get(message.guild.id) ?? [];

	const trigger = guildResponders.find((responder) => {
		const msgContent = message.content.toLowerCase();
		const triggerContent = responder.trigger.toLowerCase();

		switch (responder.matchMode) {
			case "exactly":
				return msgContent === triggerContent;
			case "startswith":
				return msgContent.startsWith(triggerContent);
			case "endswith":
				return msgContent.endsWith(triggerContent);
			case "includes":
				return msgContent.includes(triggerContent);
			default:
				return msgContent === triggerContent;
		}
	});

	if (trigger) {
		try {
			await message.reply(parseVar.execute(trigger.response, message));
			return true;
		} catch (error) {
			console.error(`Failed to send response: ${error.message}`);
			return false;
		}
	}
	return false;
};

/**
 * @param { Message } message
 */

const reqTTS = async (message, lang) => {
	const voiceChannel = message.member?.voice?.channel;
	const player = getPlayer(`${message.guild.id}::${voiceChannel?.id}`);

	modinteraction(message);
	message.fetchReply = () => {
		return null;
	};
	const tts = await Functions.get("TextToSpeech");
	try {
		if (player?.userdata) await message.react(useHooks.get("icon").yess);
	} catch (error) {}
	const context = message.content.replace(`<@${message.client.user.id}>`, "").trim();

	await tts.execute(message, context, lang, { player });
};
