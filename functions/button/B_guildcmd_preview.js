const { requireBuilderSession, refreshBuilderPreview } = require("../../utils/guildCommandBuilderActions");

module.exports.data = {
	name: "B_guildcmd_preview",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const session = await requireBuilderSession(interaction);
	if (!session) return;
	return refreshBuilderPreview(interaction, session);
};
