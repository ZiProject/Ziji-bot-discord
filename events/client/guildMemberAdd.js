/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { Events, GuildMember, AttachmentBuilder } = require("discord.js");
const config = this.config;
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
	name: Events.GuildMemberAdd,
	type: "events",
	/**
	 *
	 * @param { GuildMember } member
	 */
	execute: async (member) => {
		// create card
		const welcome = this.welcome.get(member.guild.id)?.at(0);
		if (!welcome) return;
		try {
			const attachment = await buildImageInWorker({
				ZDisplayName: member.user.username,
				ZType: "welcome",
				ZAvatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				ZMessage: `to ${member.guild.name}.`,
			});
			const channel = await member.client.channels.fetch(welcome.channel);
			const parseVar = this.functions?.get("getVariable");
			await channel.send({
				files: [
					{
						attachment,
						description:
							parseVar?.execute(welcome.content, member) ||
							`Xin chào **${member.user.name}**! Server hiện nay đã tăng thành ${member.guild.memberCount} người.`,
					},
				],
			});
		} catch (error) {
			console.error("Error building image:", error);
		}
	},
};
