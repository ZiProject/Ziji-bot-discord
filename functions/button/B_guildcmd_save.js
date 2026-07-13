const { requireBuilderSession, saveBuilderSession } = require("../../utils/guildCommandBuilderActions");

module.exports.data = {
	name: "B_guildcmd_save",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const session = await requireBuilderSession(interaction);
	if (!session) return;
	return saveBuilderSession(interaction, session);
};
