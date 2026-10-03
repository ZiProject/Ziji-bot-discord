const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { useHooks } = require("zihooks");
const { createImageStudioAttachment, prepareImageStudioAnimation } = require("./imageStudio");
const { createGreetingAnimationPayload } = require("./greetingPayload");

const GREETING_PERMISSIONS = [
	{ flag: PermissionsBitField.Flags.SendMessages, name: "Send Messages" },
	{ flag: PermissionsBitField.Flags.EmbedLinks, name: "Embed Links" },
	{ flag: PermissionsBitField.Flags.AttachFiles, name: "Attach Files" },
];

async function getMissingGreetingPermissions(channel, guild) {
	const botMember = guild.members.me || (await guild.members.fetchMe());
	const permissions = channel.permissionsFor(botMember);
	return GREETING_PERMISSIONS.filter(({ flag }) => !permissions?.has(flag)).map(({ name }) => name);
}

function isUnsentSocketError(error) {
	return error?.code === "UND_ERR_SOCKET" && error.socket?.bytesWritten === 0;
}

async function sendGreetingMessage(channel, payload) {
	try {
		return await channel.send(payload);
	} catch (error) {
		if (!isUnsentSocketError(error)) throw error;

		await new Promise((resolve) => setTimeout(resolve, 250));
		try {
			return await channel.send(payload);
		} catch (retryError) {
			if (isUnsentSocketError(retryError)) {
				throw new Error(`Discord closed the connection before sending to #${channel.name || channel.id}.`, {
					cause: retryError,
				});
			}
			throw retryError;
		}
	}
}

async function sendGreeting(member, type, targetChannel = null) {
	const isWelcome = type === "welcome";
	const welcome = useHooks.get("welcome").get(member.guild.id)?.at(0);
	const channelId = isWelcome ? welcome?.channel : welcome?.Bchannel;
	if (!welcome || (!targetChannel && !channelId)) return false;

	const rawConfig = isWelcome ? welcome.content : welcome.Bcontent;
	const fallbackDescription =
		isWelcome ?
			`Xin chào **${member.user.username}**! Server hiện nay đã tăng thành ${member.guild.memberCount} người.`
		:	`Tạm biệt ${member.user.username}! Server hiện nay chỉ còn ${member.guild.memberCount} người.`;
	const parseVar = useHooks.get("functions").get("getVariable");
	const memberAvatar = member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" });

	let greetingConfig = { description: rawConfig };
	if (rawConfig && rawConfig.startsWith("{")) {
		try {
			greetingConfig = JSON.parse(rawConfig);
		} catch (error) {
			console.error(`Error parsing ${type} configuration:`, error);
		}
	}

	const description = parseVar?.execute(greetingConfig.description, member) || fallbackDescription;
	const shouldRender = !greetingConfig.image || greetingConfig.image === "default";
	let imageName;
	let attachment;

	if (shouldRender) {
		imageName = `${type}.gif`;
		const animation = greetingConfig.animation || createGreetingAnimationPayload(type);
		const payload = prepareImageStudioAnimation(animation, {
			userAVTurl: memberAvatar,
			userName: member.user.username,
			guildName: member.guild.name,
		});
		attachment = await createImageStudioAttachment(payload, imageName);
	}

	const channel = targetChannel || (await member.client.channels.fetch(channelId));
	const missingPermissions = await getMissingGreetingPermissions(channel, member.guild);
	if (missingPermissions.length) {
		throw new Error(
			`Bot is missing ${missingPermissions.join(", ")} permission${missingPermissions.length > 1 ? "s" : ""} in #${channel.name || channel.id}`,
		);
	}
	const embed = new EmbedBuilder().setColor(useHooks.get("config").defaultColor || "Random");

	if (greetingConfig.title) {
		embed.setTitle(parseVar?.execute(greetingConfig.title, member));
	}
	if (description) {
		embed.setDescription(description);
	}
	if (greetingConfig.footer) {
		embed.setFooter({ text: parseVar?.execute(greetingConfig.footer, member) });
	}
	if (greetingConfig.thumbnail) {
		if (greetingConfig.thumbnail === "default") {
			embed.setThumbnail(memberAvatar);
		} else {
			embed.setThumbnail(parseVar?.execute(greetingConfig.thumbnail, member));
		}
	}
	if (shouldRender) {
		embed.setImage(`attachment://${imageName}`);
	} else if (greetingConfig.image) {
		embed.setImage(parseVar?.execute(greetingConfig.image, member));
	}

	const sendPayload = { embeds: [embed] };
	if (attachment) sendPayload.files = [attachment];
	try {
		await sendGreetingMessage(channel, sendPayload);
	} catch (error) {
		if (error?.name === "AbortError") {
			throw new Error(`Discord timed out while sending the greeting card to #${channel.name || channel.id}.`, {
				cause: error,
			});
		}
		throw error;
	}
	return true;
}

module.exports = { sendGreeting, getMissingGreetingPermissions };
