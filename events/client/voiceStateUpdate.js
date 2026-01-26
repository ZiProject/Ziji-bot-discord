const { Events, EmbedBuilder } = require("discord.js");
const config = require("zihooks").useHooks.get("config");
const { useHooks } = require("zihooks");
const { getPlayer } = require("ziplayer");

module.exports = {
	name: Events.VoiceStateUpdate,
	type: "events",

	/**
	 * @param { import('discord.js').VoiceState } oldState
	 * @param { import('discord.js').VoiceState } newState
	 */
	execute: async (oldState, newState) => {
		if (!oldState.client.isReady()) return;

		const guildId = newState.guild.id;
		const guildSetting = await useHooks.get("db")?.ZiGuild.findOne({ guildId });

		// Join to create
		if (guildSetting?.joinToCreate.enabled) {
			const jtcFunc = await useHooks.get("functions").get("joinToCreate");
			jtcFunc.execute(oldState, newState, guildSetting);
		}

		await Voicelogmode(oldState, newState, guildSetting);
		await playerQueue(oldState);
	},
};

const Voicelogmode = async (oldState, newState, guildSetting) => {
	if (!guildSetting?.voice.logMode) return;
	const logChannel = newState.channel || oldState.channel;
	if (!logChannel) return;
	const channelName = newState.channel?.name || oldState.channel?.name;
	const userTag = newState.member?.user.tag || oldState.member?.user.tag;

	if (newState.channelId) {
		// User joined a voice channel
		const welcomeMessages = [
			"<a:ZiBot_Dragon:1323313537229262940> Chào **{user}** đợi mãi mới thấy ông vào **{channel}**!",
			"<a:ZiBot_Dragon2:1323313583953547344> Yay, **{user}** đã tham gia **{channel}**",
		];
		const randomWelcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
		const message = randomWelcomeMsg.replace("{user}", userTag).replace("{channel}", channelName);
		logChannel.send(`${message}\n-# Toggle voice log by using /voice log`);
	} else if (oldState.channelId) {
		// User left a voice channel
		const leaveMessages = ["<:ZiBot_fuckzu:1323313619676696651> **{user}** đã rời khỏi **{channel}** rồi, buồn quá  (╥﹏╥)"];
		const randomLeaveMsg = leaveMessages[Math.floor(Math.random() * leaveMessages.length)];
		const message = randomLeaveMsg.replace("{user}", userTag).replace("{channel}", channelName);
		logChannel.send(`${message}\n-# Toggle voice log by using /voice log`).catch(() => {});
	}
};

const playerQueue = async (oldState) => {
	const client = oldState.client;

	const player = getPlayer(oldState?.guild?.id);

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
};
