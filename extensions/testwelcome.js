const util = require("node:util");
const {
	TextDisplayBuilder,
	MessageFlags,
	SectionBuilder,
	ButtonBuilder,
	ContainerBuilder,
	UserSelectMenuBuilder,
} = require("discord.js");

const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const {
	createImageStudioAttachment,
	createGreetingAnimationPayload,
	prepareImageStudioAnimation,
} = require("../utility/imageStudio");

/**
 * This extension file run at bot started.
 */

module.exports.data = {
	name: "testWelcome",
	type: "extension",
	enable: false,
};
/**
 *
 * @param {import("discord.js").Client} client
 */
module.exports.execute = async (client) => {
	//wait 1s
	await new Promise((resolve) => setTimeout(resolve, 10000));
	// Your code here ...
	console.log("Testing welcome message...");
	const guild = await client.guilds.fetch("1504721559041081387");
	const channel = await guild.channels.fetch("1504721560156766305");
	const member = await guild.members.fetch("661968947327008768");
	const payload = await sendGreeting(member, "goodbye");
	channel.send(payload).catch((err) => console.error("Error sending greeting:", err));
};

async function sendGreeting(member, type) {
	const isWelcome = type === "welcome";
	const welcome = useHooks.get("welcome").get(member.guild.id)?.at(0);
	if (!welcome || (!isWelcome && !welcome.Bchannel)) return;

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
	return sendPayload;
}
