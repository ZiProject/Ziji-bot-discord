const { useHooks } = require("zihooks");

module.exports.data = {
	name: "M_guildcmd_addmedia",
	type: "modal",
};

module.exports.execute = async ({ interaction }) => {
	const functions = useHooks.get("functions");
	const builder = functions?.get("guildCommandBuilder");
	const builderActions = functions?.get("guildCommandBuilderActions");
	const components = functions?.get("guildCommandComponents");
	const session = await builder?.execute({
		action: "getBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
	});
	if (!session) {
		return interaction.reply({ content: "Phiên builder đã hết hạn.", ephemeral: true });
	}

	const url = interaction.fields.getTextInputValue("url").trim();
	if (!url) {
		return interaction.reply({ content: "URL media không được để trống.", ephemeral: true });
	}

	const layoutCheck = await components?.execute({
		action: "validateComponentsLayout",
		layout: {
			accentColor: session.layout.accentColor || [88, 101, 242],
			blocks: [{ type: "media", url }],
		},
	});
	if (!layoutCheck.ok) {
		return interaction.reply({ content: layoutCheck.error, ephemeral: true });
	}

	session.layout.blocks.push(layoutCheck.value.blocks[0]);
	await builder?.execute({
		action: "setBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
		session,
	});
	return builderActions?.execute({ action: "refreshBuilderPreview", interaction, session });
};
