const { Events, EmbedBuilder } = require("discord.js");
const config = require("zihooks").useHooks.get("config");
const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");
const WELCOME_MESSAGES = [
	"<a:ZiBot_Dragon:1323313537229262940> Chào **{user}** đợi mãi mới thấy ông vào **{channel}**!",
	"<a:ZiBot_Dragon2:1323313583953547344> Yay, **{user}** đã tham gia **{channel}**",
];
const LEAVE_MESSAGES = ["<:ZiBot_fuckzu:1323313619676696651> **{user}** đã rời khỏi **{channel}** rồi, buồn quá  (╥﹏╥)"];

module.exports = {
	name: Events.VoiceStateUpdate,
	type: "events",

	/**
	 * @param { import('discord.js').VoiceState } oldState
	 * @param { import('discord.js').VoiceState } newState
	 */
	execute: async (oldState, newState) => {
		if (!oldState.client.isReady()) return;
		if (oldState.channelId === newState.channelId) return;
		updateVoiceStates(newState);

		const guildId = newState.guild.id;
		const guildSetting = useHooks.get("guildSettings")?.get(guildId);
		if (!guildSetting) return;

		const jtc = useHooks.get("joinToCreateCache")?.get(newState.channelId);
		const jtcFunc = await useHooks.get("functions").get("joinToCreate");

		if (jtc && jtcFunc?.execute) {
			jtcFunc.execute(oldState, newState, guildSetting);
		}

		await Promise.allSettled([Voicelogmode(oldState, newState, guildSetting), playerQueue(oldState)]);
	},
};

async function Voicelogmode(oldState, newState, guildSetting) {
	if (!guildSetting?.voice.logMode) return;
	const logChannel = newState.channel || oldState.channel;
	if (!logChannel) return;
	const channelName = newState.channel?.name || oldState.channel?.name;
	const userTag = newState.member?.user.tag || oldState.member?.user.tag;

	if (newState.channelId) {
		// User joined a voice channel
		const randomWelcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
		const message = randomWelcomeMsg.replace("{user}", userTag).replace("{channel}", channelName);
		logChannel.send(`${message}\n-# Toggle voice log by using /voice log`);
	} else if (oldState.channelId) {
		// User left a voice channel
		const randomLeaveMsg = leaveMessages[Math.floor(Math.random() * leaveMessages.length)];
		const message = randomLeaveMsg.replace("{user}", userTag).replace("{channel}", channelName);
		logChannel.send(`${message}\n-# Toggle voice log by using /voice log`).catch(() => {});
	}
}

/**
 * @param { import('discord.js').VoiceState } oldState
 */
async function playerQueue(oldState) {
	const client = oldState.client;

	const voiceChannel = oldState?.channel?.id;
	const player = getPlayer(`${oldState?.guild?.id}::${voiceChannel}`);

	if (!player || !player.connection) return;

	const botChannel = oldState?.guild?.channels?.cache?.get(player.connection?.joinConfig?.channelId);
	if (!botChannel || botChannel.id !== oldState.channelId) return;

	const requestedMember = botChannel.members.get(player.userdata?.requestedBy?.id);
	if (requestedMember) return;

	const nonBotMembers = botChannel.members.filter((m) => !m.user.bot);
	if (nonBotMembers.size < 1) return;

	const randomMember = nonBotMembers.random();
	const { channel, requestedBy, lang } = player.userdata;
	const mess = await channel.send({
		embeds: [
			new EmbedBuilder()
				.setAuthor({
					name: `${client.user.username} Player:`,
					iconURL: client.user.displayAvatarURL({ size: 1024 }),
				})
				.setDescription(lang?.music?.HostLeave.replace("{HOST}", requestedBy).replace("{USER}", randomMember.user))
				.setColor("Random")
				.setImage(config.botConfig?.Banner || null)
				.setFooter({
					text: `${lang.until.goodbye} ${requestedBy?.username}`,
					iconURL: requestedBy.displayAvatarURL({ size: 1024 }),
				})
				.setTimestamp(),
		],
	});
	setTimeout(() => mess?.delete().catch(() => {}), 20_000);
	player.userdata.requestedBy = randomMember.user;
}

async function updateVoiceStates(newState) {
	let voiceStates = useHooks.get("voiceStates");

	if (!voiceStates) {
		voiceStates = new Map();
		useHooks.set("voiceStates", voiceStates);
	}

	if (!newState?.member?.id) return;

	if (!newState.channel) {
		voiceStates.delete(newState.member.id);
		return;
	}

	voiceStates.set(newState.member.id, {
		channelId: newState.channelId,
		guildId: newState.guild.id,
		channel: newState.channel,
	});
}
