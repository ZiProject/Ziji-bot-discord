const { useHooks } = require("zihooks");
const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "M_filter",
	type: "modal",
	category: "musix",
	ckeckVoice: true,
	lock: true,
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 * @param {import("ziplayer").Player} modal.player - player
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	await interaction.deferReply().catch(() => {});
	const { fields } = interaction;
	const filter = fields.getTextInputValue("filter-input");

	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying }).catch((e) => {});

	const appliedFilters = filter
		.trim()
		.toLowerCase()
		.split(",")
		.map((filter) => filter.trim())
		.filter((filter) => filter !== "");
	if (appliedFilters.includes("OFF")) {
		await player.filter.clearAll();
		return interaction.editReply({ content: lang.music.filterApplied }).catch((e) => {});
	}
	const disabledFilters = appliedFilters?.filter((filter) => filter.startsWith("rm."));
	const enabledFilters = appliedFilters?.filter((filter) => !filter.startsWith("rm."));

	if (enabledFilters?.length === 0 && disabledFilters?.length === 0)
		return interaction.editReply({ content: lang.music.filterFailed }).catch((e) => {});

	disabledFilters?.forEach(async (filter) => {
		await player.filter.removeFilter(filter.replace("rm.", ""));
	});

	const success = await player.filter.applyFilters(enabledFilters);

	if (!success) return interaction.editReply({ content: lang.music.filterFailed }).catch((e) => {});

	const embed = new EmbedBuilder()
		.setAuthor({
			name: `${interaction.user.tag}:`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setDescription(`Applied filter: ${filter}`)
		.setColor(lang?.color || "Random")
		.setTimestamp()
		.setFooter({
			iconURL: interaction.user.displayAvatarURL(),
			text: `> ${interaction.user.username}`,
		});

	return interaction.editReply({ embeds: [embed], components: [] }).catch((e) => {
		if (interaction.replied || interaction.deferred) {
			return interaction.editReply({ embeds: [embed], components: [] });
		} else {
			return interaction.reply({ embeds: [embed], components: [] });
		}
	});
};
