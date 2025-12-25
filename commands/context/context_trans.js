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
		res.content = `${content?.text?.trim(0, 4095)}`;
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
			embed.setDescription(descriptions.text.trim(0, 4095));
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
