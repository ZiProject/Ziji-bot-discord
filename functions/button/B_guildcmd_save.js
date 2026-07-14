const { useHooks } = require("zihooks");

module.exports.data = {
	name: "B_guildcmd_save",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const builderActions = useHooks.get("functions")?.get("guildCommandBuilderActions");
	const session = await builderActions?.execute({ action: "requireBuilderSession", interaction });
	if (!session) return;
	return builderActions?.execute({ action: "saveBuilderSession", interaction, session });
};
