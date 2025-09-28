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
const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/i;

module.exports.data = {
	name: "M_editProfile",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply().catch(() => {});
	let hexColor = interaction.fields.getTextInputValue("Probcolor");

	const success = await this.db.ZiUser.updateOne(
		{ userID: interaction.user.id },
		{
			$set: {
				color: HEX_COLOR_REGEX.test(hexColor) ? hexColor : "",
			},
		},
		{ upsert: true },
	);
	const mess = success ? lang.RankSystem.editOK : lang.RankSystem.editNG;
	return interaction.editReply({
		embeds: [
			new EmbedBuilder()
				.setDescription(mess)
				.setColor(success ? "Green" : "Red")
				.setImage(this.config.botConfig.Banner)
				.setTimestamp(),
		],
	});
};
