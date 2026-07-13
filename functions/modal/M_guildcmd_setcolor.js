const { setBuilderSession } = require("../../utils/guildCommandBuilder");
const { getBuilderSession, refreshBuilderPreview } = require("../../utils/guildCommandBuilderActions");

module.exports.data = {
	name: "M_guildcmd_setcolor",
	type: "modal",
};

module.exports.execute = async ({ interaction }) => {
	const session = getBuilderSession(interaction.user.id, interaction.guild.id);
	if (!session) {
		return interaction.reply({ content: "Phiên builder đã hết hạn.", ephemeral: true });
	}

	const raw = interaction.fields.getTextInputValue("color");
	const parts = raw.split(/[,\s]+/).map((value) => Number(value.trim()));
	if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
		return interaction.reply({ content: "Màu phải là 3 số RGB, vd: `88,101,242`.", ephemeral: true });
	}

	session.layout.accentColor = parts.map((value) => Math.max(0, Math.min(255, value)));
	setBuilderSession(interaction.user.id, interaction.guild.id, session);
	return refreshBuilderPreview(interaction, session);
};
