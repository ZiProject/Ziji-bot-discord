const { useHooks } = require("zihooks");

module.exports.data = {
	name: "M_guildcmd_addtext",
	type: "modal",
};

module.exports.execute = async ({ interaction }) => {
	const functions = useHooks.get("functions");
	const builder = functions?.get("guildCommandBuilder");
	const builderActions = functions?.get("guildCommandBuilderActions");
	const session = await builder?.execute({
		action: "getBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
	});
	if (!session) {
		return interaction.reply({ content: "Phiên builder đã hết hạn.", ephemeral: true });
	}

	const content = interaction.fields.getTextInputValue("content").trim();
	if (!content) {
		return interaction.reply({ content: "Nội dung không được để trống.", ephemeral: true });
	}

	session.layout.blocks.push({ type: "text", content });
	await builder?.execute({
		action: "setBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
		session,
	});
	return builderActions?.execute({ action: "refreshBuilderPreview", interaction, session });
};
