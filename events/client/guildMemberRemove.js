const { useConfig, useWelcome } = require("@zibot/zihooks");
const { Events, GuildMember, AttachmentBuilder } = require("discord.js");
const config = useConfig();
const { Worker } = require("worker_threads");

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
				const attachment = new AttachmentBuilder(buffer, { name: "welcome.png" });
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
		const welcome = useWelcome().get(member.guild.id)?.at(0);
		if (!welcome) return;
		try {
			const attachment = await buildImageInWorker({
				ZDisplayName: member.user.username,
				ZType: "Goodbye",
				ZAvatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				ZMessage: welcome.Bcontent,
			});
			const channel = await member.client.channels.fetch(welcome.Bchannel);
			await channel.send({ files: [attachment] });
		} catch (error) {
			console.error("Error building image:", error);
		}
	},
};
