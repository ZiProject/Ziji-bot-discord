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

const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "createErrorEmbed",
	type: "utils",
};

module.exports.execute = (message) => {
	const embed = new EmbedBuilder()
		.setTitle(`❌ | Đã xảy ra lỗi`)
		.setDescription(message)
		.setColor("Red")
		.setTimestamp()
		.setThumbnail(this.client?.user?.displayAvatarURL({ size: 1024 }));
	return embed.data;
};
