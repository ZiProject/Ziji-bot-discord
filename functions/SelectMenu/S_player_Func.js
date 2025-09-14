const { useFunctions, useDB, useConfig } = require("@zibot/zihooks");
const Functions = useFunctions();
const config = useConfig();
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { getPlayer } = require("ziplayer");

module.exports.data = {
	name: "S_player_Func",
	type: "SelectMenu",
};
async function Update_Player(player) {
	const player_func = Functions.get("player_func");
	if (!player_func) return;
	const res = await player_func.execute({ player });
	player.userdata.mess.edit(res);
}

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	const { guild, client, values, user } = interaction;
	const query = values?.at(0);
	const player = getPlayer(guild.id);

	switch (player) {
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
			const QueueTrack = Functions.get("Queue");
			QueueTrack.execute(interaction, player);
			return;
		}
		case "Fillter": {
			await interaction.deferReply();
			const Fillter = Functions.get("Fillter");
			await Fillter.execute(interaction, null);
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
	const DataBase = useDB();
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
			const repeatt = ["off" | "track" | "queue"];
			const repeatMode = repeatt.findIndex(player.loop);

			player.loop(repeatt[(repeatMode + 1) % 2]);

			await Update_Player(player);
			return;
		}
		case "AutoPlay": {
			player.loop("off");
			player.autoPlay(true);
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
		// case "Lyrics": {
		// 	const ZiLyrics = queue.metadata.ZiLyrics;
		// 	if (!ZiLyrics?.Active) {
		// 		ZiLyrics.Active = true;
		// 		ZiLyrics.mess = await interaction.followUp({
		// 			content: "<a:loading:1151184304676819085> Loading...",
		// 		});
		// 		ZiLyrics.channel = interaction.channel;
		// 		const Lyrics = Functions.get("Lyrics");
		// 		if (!Lyrics) return;
		// 		await Lyrics.execute(null, { type: "syncedLyrics", player });
		// 		return;
		// 	}
		// 	ZiLyrics.mess.delete().catch(() => {});
		// 	ZiLyrics.Active = false;
		// 	try {
		// 		if (ZiLyrics?.unsubscribe && typeof ZiLyrics.unsubscribe === "function") {
		// 			ZiLyrics.unsubscribe();
		// 		}
		// 	} catch (error) {
		// 		console.error("Error unsubscribing from lyrics:", error);
		// 	}
		// 	return;
		// }
		case "Shuffle": {
			player.shuffle();
			await Update_Player(player);
			return;
		}
	}

	return;
};
