const { createImageStudioAttachment } = require("../../utility/imageStudio");

module.exports.data = {
	name: "Quote Image Generation",
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
	let msg = interaction.targetMessage;
	lang.quote = { error: lang?.quote?.error || "An error occurred while generating the quote image." };

	if (!msg.content) return interaction.editReply({ content: lang.quote.error });

	try {
		const attachment = await createImageStudioAttachment(
			{
				type: "quote",
				data: {
					quote: msg.content,
					layout: "split-portrait",
					author: msg.author.displayName,
					handle: `@${msg.author.username}`,
					tag: msg.author.tag,
					avatar: msg.author.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
				},
			},
			"quote.png",
		);
		await interaction.editReply({ files: [attachment] });
	} catch (error) {
		console.error("Error generating context quote with Image Studio:", error);
		await interaction.editReply({ content: lang.quote.error });
	}
};
