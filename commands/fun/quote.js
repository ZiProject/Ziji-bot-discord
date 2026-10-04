const { createImageStudioAttachment } = require("../../utility/imageStudio");

module.exports.data = {
	name: "quote",
	description: "Generate a quote image.",
	type: 1, // slash command
	options: [
		{
			name: "text",
			description: "Write your quote here",
			type: 3, // string
			required: true,
		},
		{
			name: "user",
			description: "The user to display",
			type: 6,
			required: false,
		},
		{
			name: "layout",
			description: "Choose the quote card layout",
			type: 3,
			required: false,
			choices: [
				{ name: "Split Portrait", value: "split-portrait" },
				{ name: "Centered Minimal", value: "centered-minimal" },
				{ name: "Modern Card", value: "modern-card" },
				{ name: "Neon Cyber", value: "neon-cyber" },
			],
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply();
	lang.quote = { error: lang?.quote?.error || "An error occurred while generating the quote image." };

	const text = interaction.options.getString("text");
	const user = interaction.options.getUser("user") || interaction.user;
	const layout = interaction.options.getString("layout") || "split-portrait";
	const payload = {
		type: "quote",
		data: {
			quote: text,
			layout,
			author: user.displayName,
			handle: `@${user.username}`,
			tag: user.tag,
			avatar: user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
		},
	};

	try {
		const attachment = await createImageStudioAttachment(payload, "quote.png");
		await interaction.editReply({ files: [attachment] });
	} catch (error) {
		console.error("Error generating quote with Image Studio:", error);
		await interaction.editReply({ content: lang.quote.error });
	}
};
