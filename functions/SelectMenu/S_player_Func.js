const { useHooks } = require("zihooks");

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports.data = {
	name: "S_player_Func",
	type: "SelectMenu",
	category: "musix",
};
async function Update_Player(player) {
	const player_func = useHooks.get("functions").get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	player.userdata.mess.edit(res).catch((e) => {});
}

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 * @param {import("ziplayer").Player} selectmenu.player - player
 */

module.exports.execute = async ({ interaction, lang, player }) => {
	const config = useHooks.get("config");
	const { guild, client, values, user } = interaction;
	const query = values?.at(0);

	switch (query) {
		case "Search": {
			const modal = new ModalBuilder()
				.setTitle("Search")
				.setCustomId("M_player_search")
				.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId("search-input")
							.setLabel("Search for a song")
							.setPlaceholder("Search or Url")
							.setStyle(TextInputStyle.Short),
					),
				);
			await interaction.showModal(modal);
			return;
		}
		case "Queue": {
			const QueueTrack = useHooks.get("functions").get("Queue");
			await QueueTrack.execute({ interaction, player });
			return;
		}
		case "Filter": {
			const Fillter = useHooks.get("commands").get("filter");
			await Fillter.execute({ interaction, lang, player });
			return;
		}
	}
	await interaction.deferUpdate().catch((e) => console.error);
	if (!player) return interaction.followUp({ content: lang.music.NoPlaying, ephemeral: true });
	// Kiểm tra xem có khóa player không
	if (player.userdata.LockStatus && player.userdata.requestedBy?.id !== interaction.user?.id)
		return interaction.followUp({ content: lang.until.noPermission, ephemeral: true });

	// Kiểm tra xem người dùng có ở cùng voice channel với bot không
	const botVoiceChannel = interaction.guild.members.me.voice.channel;
	const userVoiceChannel = interaction.member.voice.channel;
	if (!botVoiceChannel || botVoiceChannel.id !== userVoiceChannel?.id)
		return interaction.followUp({ content: lang.music.NOvoiceMe, ephemeral: true });
	const DataBase = useHooks.get("db");
	switch (query) {
		case "Lock": {
			if (player.userdata.requestedBy?.id !== user.id) {
				return interaction.reply({
					content: "You cannot interact with this menu.",
					ephemeral: true,
				});
			}
			player.userdata.LockStatus = !player.userdata.LockStatus;
			await Update_Player(player);
			return;
		}
		case "Loop": {
			const repeatt = ["off", "track", "queue"];
			const repeatMode = repeatt.indexOf(player.loop());
			player.autoPlay(false);

			player.loop(repeatt[(repeatMode + 1) % 3]);

			await Update_Player(player);
			return;
		}
		case "AutoPlay": {
			player.loop("off");
			player.autoPlay(!player.autoPlay());
			await Update_Player(player);
			return;
		}
		case "Mute": {
			player.setVolume(0);
			await Update_Player(player);
			return;
		}
		case "unmute": {
			const volumd = config?.PlayerConfig.volume ?? 100;
			if (volumd === "auto") {
				volumd = DataBase ? ((await DataBase.ZiUser.findOne({ userID: user.id }))?.volume ?? 100) : 100;
			}
			const Vol = Math.min(volumd + 10, 100);
			player.setVolume(Vol);
			await Update_Player(player);
			return;
		}
		case "volinc": {
			const current_Vol = player.volume;
			const Vol = Math.min(current_Vol + 10, 100);
			if (DataBase) {
				await DataBase.ZiUser.updateOne({ userID: user.id }, { $set: { volume: Vol }, $upsert: true });
			}
			player.setVolume(Vol);
			await Update_Player(player);
			return;
		}
		case "voldec": {
			const current_Vol = player.volume;
			const Vol = Math.max(current_Vol - 10, 0);
			if (DataBase) {
				await DataBase.ZiUser.updateOne({ userID: user.id }, { $set: { volume: Vol }, $upsert: true });
			}
			player.setVolume(Vol);
			await Update_Player(player);
			return;
		}
		case "Lyrics": {
			if (!player.userdata?.lyrcsActive) {
				player.userdata.lyrcsActive = true;
				player.userdata.lrcmess = await interaction.followUp({
					content: "<a:loading:1151184304676819085> Loading...",
				});
				return;
			}
			player.userdata.lyrcsActive = false;
			player.userdata?.lrcmess?.delete?.().catch(() => {});
			await Update_Player(player);
			return;
		}
		case "Shuffle": {
			player.shuffle();
			await Update_Player(player);
			return;
		}
	}

	return;
};
