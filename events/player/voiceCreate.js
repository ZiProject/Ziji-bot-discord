const { useHooks } = require("zihooks");
const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "voiceCreate",
	type: "Player",
	/**
	 *
	 * @param {import('ziplayer').Player} player
	 * @param {number} events
	 */
	execute: async (player, events) => {
		const { channel, useAI, focus } = player.userdata;
		if (focus && events.user.id !== focus) return;

		const lowerContent = events.content.toLowerCase();
		let messsend = null;
		const commands = {
			"skip|bỏ qua bài hát|next": () => {
				player.skip();
				console.log("Đã bỏ qua bài hát hiện tại");
				messsend = channel.send("⏭ | Skipped the current track");
			},
			"volume|âm lượng": () => {
				const volumeMatch = lowerContent.match(/\d+/);
				if (volumeMatch) {
					const newVolume = parseInt(volumeMatch[0]);
					if (newVolume >= 0 && newVolume <= 100) {
						player.setVolume(newVolume);
						console.log(`Đã đặt âm lượng thành ${newVolume}%`);
						messsend = channel.send(`🔊 | Volume set to: **${newVolume}%**`);
					} else {
						messsend = channel.send("❌ | Volume must be a number between 0 and 100");
						console.log("Âm lượng phải nằm trong khoảng từ 0 đến 100");
					}
				} else {
					messsend = channel.send(`🔊 | Current volume is: **${player.volume}**`);
					console.log("Không tìm thấy giá trị âm lượng hợp lệ trong lệnh");
				}
			},
			"pause|tạm dừng": () => {
				player.pause();
				console.log("Đã tạm dừng phát nhạc");
				messsend = channel.send("⏸ | Paused the music");
			},
			"resume|tiếp tục": () => {
				player.resume();
				console.log("Đã tiếp tục phát nhạc");
				messsend = channel.send("▶ | Resumed the music");
			},
			"disconnect|ngắt kết nối": () => {
				player.destroy();
				console.log("Đã ngắt kết nối");
				messsend = channel.send("👋 | Left the voice channel");
			},
			"auto play|tự động phát": async () => {
				player.queue.autoPlay(!player.queue.autoPlay());
				console.log("auto plays on");
				messsend = channel.send(`🔁 | Autoplay is now: **${player.queue.autoPlay() ? "Enabled" : "Disabled"}**`);
			},
			"play|phát bài hát": async () => {
				const query = lowerContent.replace(/play|phát bài hát/g, "").trim();
				const suss = await player.play(query);

				messsend = channel.send(suss ? `✅ | **${query}**` : `❌ | **${query}**`);
			},
			"xóa hàng đợi": async () => {
				player.queue.clear();
				messsend = channel.send("Queue Clear");
			},
		};

		for (const [pattern, action] of Object.entries(commands)) {
			if (lowerContent.match(new RegExp(pattern))) {
				await action();
				await messsend;
				setTimeout(function () {
					messsend?.delete?.().catch((e) => {});
				}, 5000);
				return;
			}
		}

		if (!useAI) return;
		const aiHook = useHooks.get("ai");
		if (!aiHook) return;

		const voice = useHooks.get("client").channels.cache.get(player.connection.joinConfig.channelId);
		const aifunc = await useHooks.get("functions").get("runVoiceAI");
		if (aifunc && typeof aifunc.checkStatus === "function" && aifunc.checkStatus()) {
			const result = await aiHook.run(lowerContent, events.user, player?.userdata?.lang);

			const tts = await useHooks.get("functions").get("TextToSpeech");
			await tts.execute(
				{
					client: useHooks.get("client"),
					guild: channel.guild,
					user: events.user,
					deferReply: async () => {},
					reply: async (...res) => {
						player.userdata.channel.send(...res);
					},
					editReply: async () => {},
					deleteReply: async () => {},
				},
				result.replaceAll("*", "").replaceAll("`", ""),
				player?.userdata?.lang,
				{ player, title: lowerContent, voice },
			);
		}
	},
};
