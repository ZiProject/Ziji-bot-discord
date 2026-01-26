const { EmbedBuilder, Routes } = require("discord.js");
const ZiIcons = require("../../utility/icon.js");
const { useHooks } = require("zihooks");

module.exports.data = {
	name: "S_Help",
	type: "SelectMenu",
};

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const config = useHooks.get("config");

	const selection = interaction.values?.at(0);
	const embed = new EmbedBuilder()
		.setAuthor({
			name: `${interaction.client.user.username} Help:`,
			iconURL: interaction.client.user.displayAvatarURL({ size: 1024 }),
		})
		.setDescription(lang.Help.Placeholder)
		.setColor(lang?.color || "Random")
		.setImage(config?.botConfig?.Banner || null)
		.setFooter({
			text: `${lang.until.requestBy} ${interaction.user?.username}`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();

	switch (selection) {
		case "guild_commands":
			const { guildCommands } = await this.commands(interaction);
			const guildcommands = `# ${lang.Help.GuildCommands}:\n\n${guildCommands
				.map((cmd) => {
					if (cmd.options?.at(0).type == 1) {
						let optionss = "";
						for (const option of cmd.options) {
							if (option.type == 1) {
								optionss += `</${cmd.name} ${option.name}:${cmd.id}>: ${option.description}\n`;
							}
						}
						return optionss;
					}
					return `</${cmd.name}:${cmd.id}>: ${cmd.description}\n`;
				})
				.join("")}`;
			const totalPages = Math.ceil(guildcommands.length / 4095);
			let page = 1;
			if (interaction.message?.embeds?.[0]?.fields?.[0]?.value?.includes("Page:")) {
				page = parseInt(interaction.message?.embeds?.[0]?.fields?.[0]?.value?.split("Page:")[1].split("/")[0]) + 1;
			}

			page = page > totalPages ? 1 : page;

			const startIndex = (page - 1) * 4095;
			const endIndex = startIndex + 4095;
			const currentContent = guildcommands.slice(startIndex, endIndex);
			if (guildcommands.length > 4095) {
				embed.addFields({ name: "...", value: `Page: ${page}/${totalPages}/uid=${interaction.user.id}` });
				embed.setDescription(currentContent);
			} else {
				embed.setDescription(guildcommands);
			}

			break;
		case "msg_commands":
			const { mCommandsf } = await this.commands(interaction);
			const Mcommands = `# ${lang.Help.MessCommands}:\n\n${mCommandsf
				.map((cmds) => {
					if (!("run" in cmd)) return "";
					const cmd = cmds.data;
					if (!cmd) return "";

					let optionss = `\`${config.prefix} ${cmd.name}`;
					if (cmd.alas)
						for (const alas of cmd.alas) {
							optionss += ` | ${alas}`;
						}
					optionss += `\`: ${cmd.description}\n`;
					return optionss;
				})
				.join("")}`;
			embed.setDescription(Mcommands);

			break;
		case "context_commands":
			const { contextCommands } = await this.commands(interaction);
			embed.setDescription(`# ${lang.Help.ContextCommands}:\n\n` + contextCommands.map((cmd) => `### ${cmd.name}`).join("\n\n"));
			break;
		case "player_buttons":
			const playerButtons = this.playerButtons(lang);
			embed.setDescription(
				`# ${lang.Help.PlayerButtons}:\n\n` +
					playerButtons.map((btn) => `** ${btn.icon} ${btn.name}**\n` + `* ${btn.description}`).join("\n\n"),
			);
			break;
		case "voice_commands":
			const voiceCommands = this.voiceCommands(lang);
			embed.setDescription(
				`# ${lang.Help.VoiceCommands}:\n\n` +
					voiceCommands
						.map((cmd) => `- **${cmd.name}**\n` + ` - ${cmd.description}\n` + ` - **Ví dụ:** \`${cmd.example}\``)
						.join("\n\n") +
					`\n\n## ❗ ${lang.Help.Attention}\n` +
					`- ${lang?.voiceCommands?.Note}\n\n` +
					`## 💡 ${lang.Help.Note}\n` +
					`- ${lang?.voiceCommands?.LanguageNote}`,
			);
			break;
	}
	await interaction.update({ embeds: [embed] });
};

module.exports.playerButtons = (lang) => [
	{
		name: lang?.playerButtons?.Refresh || "Làm mới",
		id: "B_player_refresh",
		description: lang?.playerFunc?.Fields?.Refresh || "Làm mới trình phát nhạc",
		icon: ZiIcons.refesh,
	},
	{
		name: lang?.playerButtons?.Previous || "Bài trước",
		id: "B_player_previous",
		description: lang?.playerFunc?.Fields?.Previous || "Phát bài hát trước đó",
		icon: ZiIcons.prev,
	},
	{
		name: lang?.playerButtons?.PausePlay || "Tạm dừng/Phát",
		id: "B_player_pause",
		description: lang?.playerFunc?.Fields?.PausePlay || "Tạm dừng hoặc tiếp tục phát nhạc",
		icon: ZiIcons.pause,
	},
	{
		name: lang?.playerButtons?.Next || "Bài tiếp",
		id: "B_player_next",
		description: lang?.playerFunc?.Fields?.Next || "Phát bài hát tiếp theo",
		icon: ZiIcons.next,
	},
	{
		name: lang?.playerButtons?.Stop || "Dừng",
		id: "B_player_stop",
		description: lang?.playerFunc?.Fields?.Stop || "Dừng phát nhạc và xóa hàng đợi",
		icon: ZiIcons.stop,
	},
	{
		name: lang?.playerButtons?.Search || "Tìm kiếm",
		id: "B_player_search",
		description: lang?.playerFunc?.Fields?.Search || "Tìm kiếm bài hát",
		icon: ZiIcons.search,
	},
	{
		name: lang?.playerButtons?.AutoPlay || "Tự động phát",
		id: "B_player_autoPlay",
		description: lang?.playerFunc?.Fields?.AutoPlay || "Bật/tắt chế độ tự động phát",
		icon: ZiIcons.loopA,
	},
	{
		name: lang?.playerButtons?.SelectTrack || "Chọn bài hát",
		id: "S_player_Track",
		description: lang?.playerFunc?.RowRel || "Chọn bài hát từ danh sách đề xuất",
		icon: ZiIcons.Playbutton,
	},
	{
		name: lang?.playerButtons?.SelectFunc || "Chức năng",
		id: "S_player_Func",
		description: lang?.playerFunc?.RowFunc || "Chọn các chức năng khác của trình phát",
		icon: ZiIcons.fillter,
	},
];

module.exports.voiceCommands = (lang) => [
	{
		name: lang?.voiceCommands?.Play || "Phát nhạc",
		description: lang?.voiceFunc?.Play || "Phát một bài hát hoặc thêm vào hàng đợi",
		example: '"play Sơn Tùng MTP Chúng ta của hiện tại"',
	},
	{
		name: lang?.voiceCommands?.Skip || "Bỏ qua",
		description: lang?.voiceFunc?.Skip || "Bỏ qua bài hát hiện tại",
		example: '"skip" hoặc "bỏ qua" hoặc "next"',
	},
	{
		name: lang?.voiceCommands?.Volume || "Âm lượng",
		description: lang?.voiceFunc?.Volume || "Điều chỉnh âm lượng (0-100)",
		example: '"volume 50" hoặc "âm lượng 75"',
	},
	{
		name: lang?.voiceCommands?.Pause || "Tạm dừng",
		description: lang?.voiceFunc?.Pause || "Tạm dừng phát nhạc",
		example: '"pause" hoặc "tạm dừng"',
	},
	{
		name: lang?.voiceCommands?.Resume || "Tiếp tục",
		description: lang?.voiceFunc?.Resume || "Tiếp tục phát nhạc",
		example: '"resume" hoặc "tiếp tục"',
	},
	{
		name: lang?.voiceCommands?.AutoPlay || "Tự động phát",
		description: lang?.voiceFunc?.AutoPlay || "Bật/tắt chế độ tự động phát",
		example: '"auto play" hoặc "tự động phát"',
	},
	{
		name: lang?.voiceCommands?.Disconnect || "Ngắt kết nối",
		description: lang?.voiceFunc?.Disconnect || "Ngắt kết nối từ kênh thoại",
		example: '"disconnect" hoặc "ngắt kết nối"',
	},
];

module.exports.commands = async (interaction) => {
	const commands = await interaction.client.rest.get(Routes.applicationCommands(interaction.client.user.id));
	const guildCommands = commands.filter((cmd) => cmd.type === 1 || cmd.type === 2);
	const contextCommands = commands.filter((cmd) => cmd.type === 3);
	const mCommandsf = useHooks.get("commands");
	return { guildCommands, contextCommands, mCommandsf };
};
