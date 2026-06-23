const { useHooks } = require("zihooks");
const { Events, GuildMember, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const config = useHooks.get("config");
const { Worker } = require("worker_threads");
const path = require("path");

const { GifRenderer } = require("canvacord-gif");

async function buildImageInWorker(workerData) {
	return new Promise((resolve, reject) => {
		const worker = new Worker("./utility/welcomeImage.js", {
			workerData, //: { ZDisplayName, ZType, ZAvatar, ZMessage, ZImage },
		});

		worker.on("message", (arrayBuffer) => {
			try {
				const buffer = Buffer.from(arrayBuffer);
				if (!Buffer.isBuffer(buffer)) {
					throw new Error("Received data is not a buffer");
				}
				const attachment = new AttachmentBuilder(buffer, { name: "GoodbyeCard.png" });
				resolve(attachment);
			} catch (error) {
				reject(error);
			} finally {
				worker.postMessage("terminate");
			}
		});

		worker.on("error", reject);

		worker.on("exit", (code) => {
			if (code !== 0) {
				reject(new Error(`Worker stopped with exit code ${code}`));
			}
		});
	});
}

module.exports = {
	name: Events.GuildMemberRemove,
	type: "events",
	/**
	 *
	 * @param { GuildMember } member
	 */
	execute: async (member) => {
		// create card
		const welcome = useHooks.get("welcome").get(member.guild.id)?.at(0);
		const parseVar = useHooks.get("functions").get("getVariable");
		if (!welcome || !welcome.Bchannel) return;

		let byeConfig = { description: welcome.Bcontent };
		if (welcome.Bcontent && welcome.Bcontent.startsWith("{")) {
			try {
				byeConfig = JSON.parse(welcome.Bcontent);
			} catch (e) {
				console.error("Error parsing welcome.Bcontent JSON:", e);
			}
		}

		const datdescription =
			parseVar?.execute(byeConfig.description, member) ||
			`Tạm biệt ${member.user.username}! Server hiện nay chỉ còn ${member.guild.memberCount} người.`;

		const shouldRender = !byeConfig.image || byeConfig.image === "default";

		try {
			let attachment = null;
			let imageName = "GoodbyeCard.gif";
			if (shouldRender) {
				const renderer = new GifRenderer({
					workers: 4,
					background: "./utility/BG.gif",
					delay: 120,
				});
				const buffer = await renderer.render({
					template: path.join(__dirname, "../../utility/WelcomeCard.js"),
					props: {
						avatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
						displayName: member.user.username,
						type: "Goodbye",
						message: `See you again in ${member.guild.name}!`,
					},
				});
				renderer.close();
				attachment = new AttachmentBuilder(buffer, {
					name: imageName,
					description: datdescription,
				});
			}

			const channel = await member.client.channels.fetch(welcome.Bchannel);
			
			const embed = new EmbedBuilder()
				.setColor(config.defaultColor || "Random");

			if (byeConfig.title) {
				embed.setTitle(parseVar?.execute(byeConfig.title, member));
			}
			if (datdescription) {
				embed.setDescription(datdescription);
			}
			if (byeConfig.footer) {
				embed.setFooter({ text: parseVar?.execute(byeConfig.footer, member) });
			}
			if (byeConfig.thumbnail) {
				if (byeConfig.thumbnail === "default") {
					embed.setThumbnail(member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }));
				} else {
					embed.setThumbnail(parseVar?.execute(byeConfig.thumbnail, member));
				}
			}
			if (shouldRender) {
				embed.setImage(`attachment://${imageName}`);
			} else if (byeConfig.image) {
				embed.setImage(parseVar?.execute(byeConfig.image, member));
			}

			const sendPayload = { embeds: [embed] };
			if (attachment) {
				sendPayload.files = [attachment];
			}

			await channel.send(sendPayload);
		} catch (error) {
			console.error("Error building image or sending goodbye:", error);
			
			let attachment = null;
			let imageName = "GoodbyeCard.png";
			if (shouldRender) {
				attachment = await buildImageInWorker({
					ZDisplayName: member.user.username,
					ZType: "Goodbye",
					ZAvatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
					ZMessage: `See you again in ${member.guild.name}!`,
				});
			}

			const channel = await member.client.channels.fetch(welcome.Bchannel);
			const embed = new EmbedBuilder()
				.setColor(config.defaultColor || "Random");

			if (byeConfig.title) {
				embed.setTitle(parseVar?.execute(byeConfig.title, member));
			}
			if (datdescription) {
				embed.setDescription(datdescription);
			}
			if (byeConfig.footer) {
				embed.setFooter({ text: parseVar?.execute(byeConfig.footer, member) });
			}
			if (byeConfig.thumbnail) {
				if (byeConfig.thumbnail === "default") {
					embed.setThumbnail(member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }));
				} else {
					embed.setThumbnail(parseVar?.execute(byeConfig.thumbnail, member));
				}
			}
			if (shouldRender) {
				embed.setImage(`attachment://${imageName}`);
			} else if (byeConfig.image) {
				embed.setImage(parseVar?.execute(byeConfig.image, member));
			}

			const sendPayload = { embeds: [embed] };
			if (attachment) {
				sendPayload.files = [attachment];
			}
			await channel.send(sendPayload);
		}
	},
};
