/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - commands collection
 * @property {import("discord.js").Collection} functions -  functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { Events, Message } = require("discord.js");
const config = this.config;
const mentionRegex = /@(everyone|here|ping)/;
const ziicon = require("./../../utility/icon");
const { getPlayer } = require("ziplayer");

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
	// Get the user's language preference
	console.log(this)
	const langfunc =  this.functions.get("ZiRank");
	const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
	//tts
	if (message.channel.isThread() && message.channel.name.startsWith(`${message?.client?.user?.username} TTS |`)) {
		return await reqTTS(message, lang);
	}
	// Auto Responder
	if (config?.DevConfig?.AutoResponder && message?.guild && (await reqreponser(message))) return; // Auto Responder
	if (!message.guild || message.mentions.has(message.client.user)) {
		// DM channel auto reply = AI
		if (!config.DevConfig.ai || !process.env?.GEMINI_API_KEY?.length) return;
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
		const commsnd = this.commands.get("help");
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
		const result = await useAI().run(prompt, message.author, lang);
		await message.reply(result);
	} catch (err) {
		this.logger.error(`Error in generating content: ${err}`);
	}
};

/**
 * @param { Message } message
 */

const reqreponser = async (message) => {
	const parseVar = this. this.functions?.get("getVariable");
	const guildResponders = this.responder.get(message.guild.id) ?? [];

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
	const player = getPlayer(message.guild.id);
	modinteraction(message);
	message.fetchReply = () => {
		return null;
	};
	const tts = await  this.functions.get("TextToSpeech");
	if (player?.userdata) await message.react(ziicon.yess);
	const context = message.content.replace(`<@${message.client.user.id}>`, "").trim();

	await tts.execute(message, context, lang, { player });
};
