const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getPlayer } = require("ziplayer");

function isNumber(str) {
	return /^[0-9]+$/.test(str);
}

function removeDuplicates(array) {
	const seen = new Set();
	return array.filter((item) => {
		if (!isNumber(item) || seen.has(item)) return false;
		seen.add(item);
		return true;
	});
}

module.exports.data = {
	name: "M_Queue_del",
	type: "modal",
};

/**
 * @param { object } modal - object modal
 * @param { import ("discord.js").ModalSubmitInteraction } modal.interaction - modal interaction
 * @param { import('../../lang/vi.js') } modal.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { guild, client, fields } = interaction;
	const player = getPlayer(guild.id);
	const input = fields.getTextInputValue("del-input");
	const trackIndices = removeDuplicates(input.split(/[\s,;.+-]+/));

	if (
		!trackIndices.length ||
		!player ||
		player.isEmpty ||
		(player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id)
	) {
		await interaction.reply({
			content: "❌ | Không thể xóa bài hát:\n" + `${trackIndices.join("\n")}`,
			ephemeral: true,
		});
		return;
	}
	await interaction.deferReply();
	let tracldel = [];
	const validIndices = trackIndices.map((index) => Math.abs(Number(index)) - 1).filter((index) => index >= 0);
	validIndices
		.sort((a, b) => b - a)
		.forEach((index) => {
			tracldel.push(player.queue.tracks.toArray()?.[index]?.title);
			player.queue.remove(index);
		});
	await interaction.editReply({
		content: "",
		embeds: [
			new EmbedBuilder()
				.setColor("Red")
				.setAuthor({
					name: "Deleted track:",
					iconURL: client.user.displayAvatarURL({ size: 1024 }),
				})
				.setDescription(`${tracldel.map((t) => `\n* ${t}`.slice(0, 50)).join("")}`.slice(0, 2000))
				.setTimestamp()
				.setFooter({
					text: `Đã thêm bởi: ${interaction.user.tag} `,
					iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
				}),
		],
		components: [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("B_cancel").setLabel("❌").setStyle(ButtonStyle.Secondary),
			),
		],
	});
};
