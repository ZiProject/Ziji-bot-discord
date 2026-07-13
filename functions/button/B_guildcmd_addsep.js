const { setBuilderSession } = require("../../utils/guildCommandBuilder");
const { requireBuilderSession, refreshBuilderPreview } = require("../../utils/guildCommandBuilderActions");

module.exports.data = {
	name: "B_guildcmd_addsep",
	type: "button",
};

module.exports.execute = async ({ interaction }) => {
	const session = await requireBuilderSession(interaction);
	if (!session) return;

	session.layout.blocks.push({ type: "separator", divider: true, spacing: 1 });
	setBuilderSession(interaction.user.id, interaction.guild.id, session);
	return refreshBuilderPreview(interaction, session);
};
