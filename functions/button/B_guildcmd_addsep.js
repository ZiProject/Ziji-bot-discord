const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_addsep",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const functions = useHooks.get("functions");
	const builderActions = functions?.get("guildCommandBuilderActions");
	const builder = functions?.get("guildCommandBuilder");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;

	session.layout.blocks.push({ type: "separator", divider: true, spacing: 1 });
	await builder?.execute({
		action: "setBuilderSession",
		userId: interaction.user.id,
		guildId: interaction.guild.id,
		session,
	});
	return builderActions?.execute({ action: "refreshBuilderPreview", interaction, session });
};
