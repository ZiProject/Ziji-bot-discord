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

module.exports = async (apps) => {
	try {
		let indexs = 0;
		const responders = await this.db.ZiAutoresponder.find();
		responders.forEach((responder) => {
			const autoRes = this.responder;
			if (!autoRes.has(responder.guildId)) {
				autoRes.set(responder.guildId, []);
			}
			autoRes.get(responder.guildId).push({
				trigger: responder.trigger,
				response: responder.response,
				matchMode: responder.options.matchMode,
			});
			indexs++;
		});
		this.logger.info(`Successfully reloaded ${indexs} Auto Responders.`);
	} catch (error) {
		this.logger.error("Lỗi khi tải autoresponders:", error);
	}
};
