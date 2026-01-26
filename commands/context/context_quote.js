const { useHooks } = require("zihooks");
const Commands = useHooks.get("commands");

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
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	await interaction.deferReply();
	let msg = interaction.targetMessage;
	lang.quote = { error: lang?.quote?.error || "An error occurred while generating the quote image." };

	if (!msg.content) return interaction.editReply({ content: lang.quote.error });

	const context = {
		text: msg.content,
		backgroundImage: msg.author.displayAvatarURL({ size: 1024, dynamic: true, format: "png" }),
		author: msg.author.displayName,
		tag: msg.author.username,
		bgcolor: true,
		watermark: interaction.client.user.tag,
	};
	const Quote = Commands.get("quote");

	let cardimage = await Quote.tryMIQ(context).catch(async (error) => {
		console.error("Error in quote MIQ:", error);
		return null;
	});

	if (!cardimage) {
		cardimage = await Quote.tryLocal(context).catch((error) => {
			console.error("Error in quote local:", error);
			return null;
		});
	}

	if (!cardimage) {
		await interaction.editReply({ content: lang.quote.error });
		return;
	}

	await interaction.editReply({ files: [{ attachment: cardimage, name: "quote.png" }] });

	return;
};
