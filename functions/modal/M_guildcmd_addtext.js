const { setBuilderSession } = require("../../utils/guildCommandBuilder");
const { getBuilderSession, refreshBuilderPreview } = require("../../utils/guildCommandBuilderActions");

module.exports.data = {
	name: "M_guildcmd_addtext",
	type: "modal",
};

module.exports.execute = async ({ interaction }) => {
	const session = getBuilderSession(interaction.user.id, interaction.guild.id);
	if (!session) {
		return interaction.reply({ content: "Phiên builder đã hết hạn.", ephemeral: true });
	}

	const content = interaction.fields.getTextInputValue("content").trim();
	if (!content) {
		return interaction.reply({ content: "Nội dung không được để trống.", ephemeral: true });
	}

	session.layout.blocks.push({ type: "text", content });
	setBuilderSession(interaction.user.id, interaction.guild.id, session);
	return refreshBuilderPreview(interaction, session);
};
