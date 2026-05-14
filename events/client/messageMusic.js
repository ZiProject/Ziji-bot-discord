const { Events, Message } = require("discord.js");
const { modinteraction, useHooks } = require("zihooks");
const config = useHooks.get("config");
const mentionRegex = /@(everyone|here|ping)/;
const { getPlayer } = require("ziplayer");

const Commands = useHooks.get("commands");
const Functions = useHooks.get("functions");

module.exports = {
	name: Events.MessageCreate,
	type: "events",
	enable: true,
};

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
	if (!message.client.isReady()) return;

	const guiPlay = useHooks.get("temp").get(`music_channel_${message.guild?.id}`);
	if (!guiPlay || message.channel.id !== guiPlay) return;
	if (message.author.bot && message.author.id !== message.client.user.id) return message.delete().catch(() => {});
	if (message.author.id === message.client.user.id) return;
	if (mentionRegex.test(message.content)) return message.delete().catch(() => {});

	const context = message.content.replace(`<@${message.client.user.id}>`, "").trim();

	if (!context) {
		return message.delete().catch(() => {});
	}

	const langfunc = Functions.get("ZiRank");
	const lang = await langfunc.execute({ user: message.author, XpADD: 0 });

	// fetch playerMessage in top channel if exist
	const playerMessage = await message.channel.messages.fetch({ limit: 10 }).then((messages) => {
		//player description start whith "Volume: "
		return messages
			.filter(
				(msg) =>
					msg.author.id === message.client.user.id &&
					msg.embeds.length > 0 &&
					msg.embeds[0].description &&
					msg.embeds[0].description.startsWith("Volume: "),
			)
			.first();
	});
	const player = getPlayer(message.guild.id);

	message.editReply = (content) => {
		return message.channel.send(content).catch(() => {});
	};

	modinteraction(message);

	message.fetchReply = () => {
		return null;
	};
	message.reply = (content) => {
		return message.channel.send(content).catch(() => {});
	};

	if (playerMessage && !player?.userdata) {
		message.customId = "S_player_Search";
		message.message = playerMessage;
	} else if (playerMessage && player?.userdata) {
		player.userdata.mess = playerMessage;
		player.userdata.channel = playerMessage.channel;
	}

	const Search = await Functions.get("playerController");

	await Search.execute(message, context, lang, { player });

	await setTimeout(() => {
		purgeChannel(message);
	}, 50000);
	return;
};

async function purgeChannel(message) {
	const Player = getPlayer(message.guild.id);
	if (!Player?.userdata?.mess) return;
	if (Player.userdata.mess.channel?.id !== message.channel.id) return;

	let PlayerMess = Player.userdata?.mess;

	const messages = await message.channel.messages.fetch({ limit: 100 });
	//delete all messages - except messages of player
	messages.forEach((msg) => {
		if (msg.id === PlayerMess.id) return;
		msg.delete().catch(() => {});
	});
}
