const ZiIcons = require("./../../utility/icon");
const {
	EmbedBuilder,
	ActionRowBuilder,
	BaseInteraction,
	StringSelectMenuOptionBuilder,
	StringSelectMenuBuilder,
} = require("discord.js");

//====================================================================//
const buttonConfigs = [
	{ label: "Disable All", id: "OFF", description: "Turn off effects" },
	{ label: "Bass Boost Low", id: "bassboost_low", description: "Mild low-end boost" },
	{ label: "Bass Boost", id: "bassboost", description: "Low-end boost" },
	{ label: "Bass Boost High", id: "bassboost_high", description: "Strong low-end boost" },
	{ label: "8D", id: "8D", description: "Immersive 8D effect" },
	{ label: "Nightcore", id: "nightcore", description: "Fast tempo, high pitch" },
	{ label: "Tremolo", id: "tremolo", description: "Amplitude modulation" },
	{ label: "Vibrato", id: "vibrato", description: "Pitch modulation" },
	{ label: "Reverse", id: "reverse", description: "Reverse audio" },
	{ label: "Treble", id: "treble", description: "High-end boost" },
	{ label: "Normalizer", id: "normalizer", description: "Normalize volume" },
	{ label: "Sub Boost", id: "subboost", description: "Sub-bass boost" },
	{ label: "Karaoke", id: "karaoke", description: "Reduce vocals" },
	{ label: "Mono", id: "mono", description: "Convert to mono" },
	{ label: "MSTLR", id: "mstlr", description: "Swap L/R channels" },
	{ label: "MSTRR", id: "mstrr", description: "Rotate channels" },
	{ label: "Compressor", id: "compressor", description: "Dynamic compression" },
	{ label: "Expander", id: "expander", description: "Expand dynamic range" },
	{ label: "Soft Limiter", id: "softlimiter", description: "Prevent clipping" },
	{ label: "Chorus", id: "chorus", description: "Chorus effect" },
	{ label: "Chorus 2D", id: "chorus2d", description: "2D chorus effect" },
	{ label: "Chorus 3D", id: "chorus3d", description: "3D chorus effect" },
	{ label: "Fade In", id: "fadein", description: "Volume fade-in" },
	{ label: "Lofi", id: "lofi", description: "Low-fidelity effect" },
	{ label: "Silence Remove", id: "silenceremove", description: "Remove silence" },
];
const createButton = (index, label, description, customId) => {
	return new StringSelectMenuOptionBuilder()
		.setLabel(`${index + 1} - ${label}`)
		.setDescription(`${description}`)
		.setEmoji(ZiIcons.noo)
		.setValue(`${customId}`);
};

const FillterRow = async (queue) => {
	const buttons = buttonConfigs.map((config, index) => {
		const button = createButton(index, config.label, config.description, config.id);
		if (config.id == "OFF") return button.setEmoji("❌");
		if (queue.filters.ffmpeg?.isEnabled(config.id)) {
			button.setEmoji(ZiIcons.yess);
		}
		return button;
	});

	return new ActionRowBuilder().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId("S_player_Fillter")
			.setMinValues(1)
			.setMaxValues(1)
			.setPlaceholder("▶️ | Pick the audio effect.")
			.addOptions(buttons),
	);
};

const Fillter = async (user, queue) => {
	let row = await FillterRow(queue);
	let embed = new EmbedBuilder()
		.setColor("Random")
		.setTimestamp()
		.setTitle(`Audio Effect Control Panel`)
		.setDescription(
			`**${
				queue?.filters?.ffmpeg?.getFiltersEnabled().length ?
					queue?.filters?.ffmpeg
						?.getFiltersEnabled()
						.map((item) => `* ${item.trim()}`)
						.join("\n")
				:	"Không có bộ lọc nào được kích hoạt."
			}**\n* Lưu ý: nếu thời lượng nhạc dài, thời gian áp dụng bộ lọc có thể dài hơn tương ứng.`,
		)

		.setFooter({
			text: `Đã thêm bởi: ${user?.tag}`,
			iconURL: user?.displayAvatarURL({ dynamic: true }),
		});

	return { embeds: [embed], components: [row] };
};
//====================================================================//

/**
 * @param { BaseInteraction } interaction
 * @param { string } query
 */

module.exports.execute = async (interaction, fillterr) => {
	const queue = useQueue(interaction.guild.id);
	if (!queue) return;
	if (fillterr == "OFF") {
		await queue?.filters?.ffmpeg?.setFilters(false);
		await interaction?.message?.delete().catch((e) => {});
		return;
	}
	if (fillterr) {
		await queue?.filters.ffmpeg.toggle(`${fillterr}`);
		await interaction?.message.edit(await Fillter(interaction?.user, queue)).catch((e) => {});
		return;
	}
	await interaction.editReply(await Fillter(interaction?.user, queue));
	return;
};
//====================================================================//
module.exports.data = {
	name: "Fillter",
	type: "player",
	enable: false,
};
