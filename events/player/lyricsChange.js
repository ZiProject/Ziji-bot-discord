const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "lyricsChange",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {import('ziplayer').Track} track
	 * @param {object} result
	 */
	execute: async (player, track, result) => {
		if (!player?.userdata?.lyrcsActive) return;
		const embed = new EmbedBuilder()
			.setTitle("Lyrics: " + track?.title)
			.setThumbnail(track?.thumbnail)
			.setColor("Random")
			.setTimestamp()
			.setFooter({
				text: `by: ${track?.requestedBy?.username}`,
				iconURL: track?.requestedBy?.displayAvatarURL?.({ size: 1024 }) ?? null,
			});
		let msg;
		if (result.current) {
			msg = [
				result.previous ? `Prev: ${result.previous}` : null,
				`Curr: **${result.current}**`,
				result.next ? `Next: ${result.next}` : null,
			]
				.filter(Boolean)
				.join("\n");
		} else if (result.text) {
			msg = result.text.slice(0, 1990) + (result.text.length > 1990 ? "..." : "");
		}
		embed.setDescription(msg);
		try {
			if (player?.userdata?.lrcmess) {
				player.userdata.lrcmess.edit({ embeds: [embed] });
			} else {
				const lrcmess = await player.userdata.mess.reply({ embeds: [embed] });
				player.userdata.lrcmess = lrcmess;
			}
		} catch {
			const lrcmess = await player?.userdata?.mess?.reply({ embeds: [embed] }).catch(async (e) => {
				return await player?.userdata?.channel?.send({ embeds: [embed] });
			});
			player.userdata.lrcmess = lrcmess;
		}
	},
};
