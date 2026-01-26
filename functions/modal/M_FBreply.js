const { useHooks } = require("zihooks");
const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "M_FBreply",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { fields, client } = interaction;
	const ids = fields.getTextInputValue("ids");
	const mess = fields.getTextInputValue("mess");

	const [messID, channelID] = ids.split("::");

	await interaction.deferUpdate();
	const channel = await client.channels.fetch(channelID).catch(() => null);

	if (!channel) return;
	const msg = await channel.messages.fetch(messID).catch(() => null);

	if (!msg) return;
	const reply = await msg.reply({
		embeds: [
			new EmbedBuilder()
				.setAuthor({
					name: `${interaction.user.tag}:`,
					iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
				})
				.setDescription(mess)
				.setTimestamp()
				.setFooter({
					iconURL: interaction.user.displayAvatarURL(),
					text: `> ${interaction.user.username}`,
				})
				.setColor(lang?.color || "Random"),
		],
	});
};
