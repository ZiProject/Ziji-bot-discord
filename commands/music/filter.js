const { getPlayer } = require("ziplayer");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
module.exports.data = {
	name: "filter",
	description: "Quản lý bộ lọc",
	category: "musix",
	type: 1, // slash commad
	options: [
		{
			name: "filter",
			description: "Tên bộ lọc",
			type: 3,
			autocomplete: true,
		},
	],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang
 * @param {import("ziplayer").Player} command.player - player
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	await interaction.deferReply({ withResponse: true });
	if (!player?.connection) return interaction.editReply({ content: lang.music.NoPlaying }).catch((e) => {});
	const fillterr = interaction.options?.getString?.("filter");
	const availableFilters = player?.filter.getAvailableFilters();
	const activeFilters = player?.filter.getActiveFilters();
	if (!fillterr || !availableFilters?.find((filter) => filter.name?.toLowerCase() == fillterr?.toLowerCase())) {
		const filterList = availableFilters?.map((filter) => `\`${filter.name}\`: ${filter.description}`).join("\n");
		return interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(lang?.color || "Random")
					.setTitle(`Active filters: ${activeFilters?.length || 0}`)
					.setDescription(
						activeFilters?.length > 0 ?
							`${activeFilters?.map((filter) => `\`${filter}\``).join(", ")}`
						:	`${lang.music.NoActiveFilters}`,
					)
					.setTimestamp()
					.setFooter({
						text: "ZiBot • Fillter",
						iconURL: interaction.client.user.displayAvatarURL(),
					}),
				new EmbedBuilder()
					.setTitle(`List filter available: ${availableFilters?.length || 0}`)
					.setDescription(`${filterList}`.slice(0, 4095))
					.setColor(lang?.color || "Random")
					.setTimestamp()
					.setFooter({
						text: "ZiBot • Fillter",
						iconURL: interaction.client.user.displayAvatarURL(),
					}),
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId("B_filter_modal").setLabel("Manager filters").setStyle(ButtonStyle.Secondary),
				),
			],
		});
	}
	if (fillterr == "OFF") {
		await player?.filter.clearAll();
	}

	await player?.filter.applyFilter(`${fillterr}`);

	return interaction.editReply({ content: lang.music.filterApplied }).catch((e) => {});
};

module.exports.autocomplete = async ({ interaction }) => {
	const player = getPlayer(interaction.guild.id);
	if (!player) return [];
	const choice = interaction.options.getFocused();
	const availableFilters = player?.filter.getAvailableFilters();
	const choices = availableFilters
		.filter((filter) => filter.name.toLowerCase().startsWith(choice.toLowerCase()))
		.map((filter) => ({ name: filter.name, value: filter.name }))
		.slice(0, 24);
	choices.push({ name: "OFF", value: "OFF" });
	await interaction.respond(choices).catch((e) => {});
};
