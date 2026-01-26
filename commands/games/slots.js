const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");

const maxBet = 250000;
const zigoldEmoji = "🪙"; // ZiGold emoji
const slotEmojis = ["🍇", "🍊", "🍋", "🍌", "🍎", "🍓", "🥝", "🥥"];
const spinEmoji = "🎰";

// Winning combinations and multipliers
const winningCombos = {
	// Three of a kind
	triple: { multiplier: 5, description: "Triple!" },
	// Two matching + different third
	double: { multiplier: 2, description: "Double!" },
	// All different
	lose: { multiplier: 0, description: "Better luck next time!" },
};

module.exports.data = {
	name: "slots",
	description: "Trò chơi slots với hệ thống cược ZiGold",
	type: 1,
	options: [
		{
			name: "bet",
			description: "Số ZiGold muốn cược (mặc định: 100)",
			type: 4,
			required: false,
			min_value: 1,
			max_value: maxBet,
		},
	],
	integration_types: [0],
	contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import("../../lang/vi.js") } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	const DataBase = useHooks.get("db");
	let bet = interaction.options.getInteger("bet") || 100;
	const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

	// Validate bet amount
	if (bet <= 0) {
		const errorEmbed = new EmbedBuilder()
			.setTitle("❌ Lỗi")
			.setColor("#FF0000")
			.setDescription("Bạn không thể cược số tiền <= 0!");
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}

	if (bet > maxBet) {
		bet = maxBet;
	}

	// Check database availability
	if (!DataBase) {
		const errorEmbed = new EmbedBuilder()
			.setTitle("❌ Lỗi Database")
			.setColor("#FF0000")
			.setDescription("Không thể kết nối đến database. Vui lòng thử lại sau!");
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}

	try {
		// Check if user has enough ZiGold
		const userDB = await DataBase.ZiUser.findOne({ userID: interaction.user.id });
		const userBalance = userDB?.coin || 0;

		if (userBalance < bet) {
			const errorEmbed = new EmbedBuilder()
				.setTitle("❌ Không đủ ZiGold")
				.setColor("#FF0000")
				.setDescription(
					`Bạn không có đủ ZiGold để cược! Bạn có **${userBalance.toLocaleString()} ZiGold** nhưng cần **${bet.toLocaleString()} ZiGold**.`,
				)
				.addFields({
					name: "💡 Gợi ý",
					value: "Sử dụng `/zigold` để kiểm tra số dư hoặc `/daily` để nhận ZiGold miễn phí!",
				});
			return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
		}

		// Initial spinning embed
		const spinningEmbed = new EmbedBuilder()
			.setTitle(`${spinEmoji} ZiGold Slots`)
			.setColor("#FFD700")
			.setDescription(
				`**${userName}** đã cược **${zigoldEmoji} ${bet.toLocaleString()} ZiGold**\n\n` +
					`${spinEmoji} ${spinEmoji} ${spinEmoji}\n` +
					`🎰 Máy slots đang quay...`,
			)
			.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

		const message = await interaction.reply({ embeds: [spinningEmbed], fetchReply: true });

		// Simulate slot machine delay
		setTimeout(async () => {
			try {
				// First, atomically deduct the bet amount
				const deductResult = await DataBase.ZiUser.findOneAndUpdate(
					{ userID: interaction.user.id, coin: { $gte: bet } },
					{ $inc: { coin: -bet, xp: 1 } },
					{ new: true, upsert: false },
				);

				if (!deductResult) {
					const errorEmbed = new EmbedBuilder()
						.setTitle("❌ Không đủ ZiGold")
						.setColor("#FF0000")
						.setDescription("Bạn không còn đủ ZiGold để thực hiện cược này!");
					return await message.edit({ embeds: [errorEmbed] });
				}

				// Generate random slot results
				const slot1 = slotEmojis[Math.floor(Math.random() * slotEmojis.length)];
				const slot2 = slotEmojis[Math.floor(Math.random() * slotEmojis.length)];
				const slot3 = slotEmojis[Math.floor(Math.random() * slotEmojis.length)];

				// Determine win condition and multiplier
				let winType, multiplier, resultText, embedColor;
				let winAmount = 0;
				let newBalance = deductResult.coin;

				if (slot1 === slot2 && slot2 === slot3) {
					// Triple match - biggest win
					winType = "triple";
					multiplier = winningCombos.triple.multiplier;
					// Total payout = bet * multiplier (already deducted bet, so add full payout)
					winAmount = bet * multiplier;
					const totalPayout = winAmount;
					const profit = winAmount - bet;
					resultText = `🎉 ${winningCombos.triple.description} Bạn thắng **${zigoldEmoji} ${profit.toLocaleString()} ZiGold** (${multiplier}x)!`;
					embedColor = "#00FF00";
				} else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
					// Double match - medium win
					winType = "double";
					multiplier = winningCombos.double.multiplier;
					// Total payout = bet * multiplier (already deducted bet, so add full payout)
					winAmount = bet * multiplier;
					const totalPayout = winAmount;
					const profit = winAmount - bet;
					resultText = `🎊 ${winningCombos.double.description} Bạn thắng **${zigoldEmoji} ${profit.toLocaleString()} ZiGold** (${multiplier}x)!`;
					embedColor = "#FFA500";
				} else {
					// No match - lose
					winType = "lose";
					multiplier = 0;
					winAmount = 0;
					resultText = `😢 ${winningCombos.lose.description} Bạn thua **${zigoldEmoji} ${bet.toLocaleString()} ZiGold**`;
					embedColor = "#FF0000";
				}

				// Award winnings if applicable
				if (winAmount > 0) {
					const winResult = await DataBase.ZiUser.findOneAndUpdate(
						{ userID: interaction.user.id },
						{ $inc: { coin: winAmount } },
						{ new: true },
					);
					newBalance = winResult.coin;
				}

				// Create detailed calculation text
				let calculationText = "";
				if (winAmount > 0) {
					const profit = winAmount - bet;
					calculationText =
						`📊 **Cách tính tiền:**\n` +
						`• Tiền cược: -${bet.toLocaleString()} ZiGold\n` +
						`• Payout (${multiplier}x): +${winAmount.toLocaleString()} ZiGold\n` +
						`• Lợi nhuận: +${profit.toLocaleString()} ZiGold\n\n`;
				} else {
					calculationText =
						`📊 **Cách tính tiền:**\n` +
						`• Tiền cược: -${bet.toLocaleString()} ZiGold\n` +
						`• Không có combo nào → Thua toàn bộ\n\n`;
				}

				// Create result embed
				const resultEmbed = new EmbedBuilder()
					.setTitle(`${spinEmoji} ZiGold Slots - Kết quả`)
					.setColor(embedColor)
					.setDescription(
						`**${userName}** đã cược **${zigoldEmoji} ${bet.toLocaleString()} ZiGold**\n\n` +
							`${slot1} ${slot2} ${slot3}\n\n` +
							`🎯 ${resultText}\n\n` +
							`${calculationText}` +
							`💰 **Số dư mới: ${newBalance.toLocaleString()} ZiGold**`,
					)
					.addFields(
						{
							name: "🎰 Tỷ lệ thắng",
							value: "🍇🍇🍇 = 5x cược\n🍊🍊🍋 = 2x cược\n🍇🍊🍋 = Thua",
							inline: true,
						},
						{
							name: "🎮 Thống kê",
							value: `Cược: ${bet.toLocaleString()}\nKết quả: ${winAmount > 0 ? `+${(winAmount - bet).toLocaleString()}` : `-${bet.toLocaleString()}`}`,
							inline: true,
						},
					)
					.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

				await message.edit({ embeds: [resultEmbed] });
			} catch (error) {
				console.error("Slots error:", error);
				const errorEmbed = new EmbedBuilder()
					.setTitle("❌ Lỗi")
					.setColor("#FF0000")
					.setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại!");
				await message.edit({ embeds: [errorEmbed] });
			}
		}, 2500); // 2.5 second delay for suspense
	} catch (error) {
		console.error("Slots error:", error);
		const errorEmbed = new EmbedBuilder()
			.setTitle("❌ Lỗi")
			.setColor("#FF0000")
			.setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại!");
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
};
