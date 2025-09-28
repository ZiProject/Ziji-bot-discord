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
const translate = require("@iamtraction/google-translate");

module.exports.data = {
	name: "Translate",
	type: 3, // context
	options: [],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } context - object command
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } context.interaction - interaction
 * @param { import('../../lang/vi.js') } context.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	const { targetMessage, user } = interaction;
	const res = { content: "" };
	if (targetMessage.content) {
		const content = await translate(targetMessage.content, { to: lang?.name || "en" });
		res.content = `${content.text}`;
	}
	if (targetMessage.embeds.length) {
		const revembed = targetMessage.embeds?.at(0)?.data;
		const embed = new EmbedBuilder()
			.setFooter({
				text: `${lang.until.requestBy} ${user?.username}`,
				iconURL: user.displayAvatarURL({ size: 1024 }),
			})
			.setTimestamp()
			.setThumbnail(revembed?.thumbnail?.url || null)
			.setImage(revembed?.image?.url || null)
			.setColor(revembed?.color || null);

		if (revembed?.description) {
			const descriptions = await translate(revembed.description, { to: lang?.name || "en" });
			embed.setDescription(descriptions.text);
		}
		if (revembed?.title) {
			const titles = await translate(revembed.title, { to: lang?.name || "en" });
			embed.setTitle(titles.text);
		}
		if (revembed?.author) {
			const authorname = await translate(revembed.author.name, { to: lang?.name || "en" });
			embed.setAuthor({
				name: authorname.text.length ? authorname.text : " ",
				iconURL: revembed.author?.icon_url,
				url: revembed.author?.url,
			});
		}
		if (revembed?.fields?.length) {
			for (const field of revembed.fields) {
				const fieldname = await translate(field.name, { to: lang?.name || "en" });
				const fieldvalue = await translate(field.value, { to: lang?.name || "en" });
				embed.addFields({
					name: fieldname.text.length ? fieldname.text : " ",
					value: fieldvalue.text.length ? fieldvalue.text : " ",
					inline: field.inline,
				});
			}
		}
		res.embeds = [embed];
	}
	await interaction.editReply(res);
	return;
};
