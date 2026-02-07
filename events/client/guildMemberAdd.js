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
				const attachment = new AttachmentBuilder(buffer, { name: "WelcomeCard.png" });
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
	name: Events.GuildMemberAdd,
	type: "events",
	/**
	 *
	 * @param { GuildMember } member
	 */
	execute: async (member) => {
		// create card
		const welcome = useHooks.get("welcome").get(member.guild.id)?.at(0);
		const parseVar = useHooks.get("functions").get("getVariable");
		if (!welcome) return;

		const datadescription =
			parseVar?.execute(welcome.content, member) ||
			`Xin chào **${member.user.name}**! Server hiện nay đã tăng thành ${member.guild.memberCount} người.`;
		try {
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
					type: "welcome",
					message: `to ${member.guild.name}.`,
				},
			});
			renderer.close();
			const attachment = new AttachmentBuilder(buffer, {
				name: "WelcomeCard.gif",
				description: datadescription,
			});
			// send welcome
			const channel = await member.client.channels.fetch(welcome.channel);
			await channel.send({
				embeds: [
					new EmbedBuilder()
						.setDescription(datadescription)
						.setColor(config.defaultColor)
						.setImage("attachment://WelcomeCard.gif"),
				],
				files: [attachment],
			});
			return;
		} catch (error) {
			console.error("Error building image:", error);

			const attachment = await buildImageInWorker({
				ZDisplayName: member.user.username,
				ZType: "welcome",
				ZAvatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				ZMessage: `to ${member.guild.name}.`,
			});
			const channel = await member.client.channels.fetch(welcome.channel);
			await channel.send({
				embeds: [
					new EmbedBuilder()
						.setDescription(datadescription)
						.setColor(config.defaultColor)
						.setImage("attachment://WelcomeCard.png"),
				],
				files: [attachment],
			});
		}
	},
};
