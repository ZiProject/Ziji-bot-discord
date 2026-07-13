const { useHooks } = require("zihooks");

module.exports.data = {
	name: "M_guildcmd_addsection",
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

	const content = interaction.fields.getTextInputValue("content").trim();
	const buttonJson = interaction.fields.getTextInputValue("buttonJson").trim();
	if (!content) {
		return interaction.reply({ content: "Nội dung section không được để trống.", ephemeral: true });
	}

	let buttonPayload;
	if (buttonJson) {
		try {
			buttonPayload = JSON.parse(buttonJson);
		} catch {
			return interaction.reply({ content: "Button accessory phải là JSON hợp lệ.", ephemeral: true });
		}
	}

	const layoutCheck = await components?.execute({
		action: "validateComponentsLayout",
		layout: {
			accentColor: session.layout.accentColor || [88, 101, 242],
			blocks: [{ type: "section", content, button: buttonPayload }],
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
