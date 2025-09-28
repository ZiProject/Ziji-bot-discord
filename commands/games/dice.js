/**
 * @fileoverview Ziji Bot Discord - App Class System
 * @global
 * @typedef {Object} ModuleContext
 * @property {import("../../core/App").App} app - App instance
 * @property {import("discord.js").Client} client - Discord client instance
 * @property {import("discord.js").Collection} cooldowns - Cooldowns collection
 * @property {import("discord.js").Collection} commands - Commands collection
 * @property {import("discord.js").Collection} functions - Functions collection
 * @property {import("discord.js").Collection} responder - Responder collection
 * @property {import("discord.js").Collection} welcome - Welcome collection
 * @property {import("discord-giveaways").GiveawaysManager|Function} giveaways - Giveaways manager
 * @property {import("ziplayer").PlayerManager} manager - Player manager
 * @property {Object} config - Configuration object
 * @property {Object} logger - Logger instance
 * @property {Object} db - Database instance
 */

const { EmbedBuilder } = require("discord.js");
const { updateQuestProgress } = require("./quests");

const maxBet = 250000;
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const diceEmoji = "🎲"; // Biểu tượng xúc xắc
const fireEmoji = "🔥"; // Biểu tượng lửa
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const trophyEmoji = "🏆"; // Biểu tượng cúp

// Kết quả xúc xắc và hệ số nhân
const diceOutcomes = {
	1: { emoji: "⚪", name: "Một", multiplier: 0 },
	2: { emoji: "🟢", name: "Hai", multiplier: 0 },
	3: { emoji: "🔵", name: "Ba", multiplier: 1.5 },
	4: { emoji: "🟡", name: "Bốn", multiplier: 2 },
	5: { emoji: "🟠", name: "Năm", multiplier: 3 },
	6: { emoji: "🔴", name: "Sáu", multiplier: 5 },
};

module.exports.data = {
	name: "dice",
	description: "Lăn hai con xúc xắc và cược vào tổng điểm!",
	type: 1,
	options: [
		{
			name: "prediction",
			description: "Dự đoán tổng điểm (2-12)",
			type: 4,
			required: true,
			min_value: 2,
			max_value: 12,
		},
		{
			name: "bet",
			description: "Số ZiGold muốn cược (mặc định: 100)",
			type: 4,
			required: false,
			min_value: 1,
			max_value: maxBet,
		},
	],
	integration_types: [0, 1], // Ứng dụng máy chủ + Ứng dụng người dùng
	contexts: [0, 1, 2], // Máy chủ + Tin nhắn riêng + Kênh riêng tư
	dm_permission: true,
	nsfw: false,
};

module.exports.execute = async ({ interaction, lang }) => {
	try {
		const ZiRank = this.functions?.get("ZiRank");
		const DataBase = this.db;

		// Kiểm tra xem cơ sở dữ liệu và các hàm được khởi tạo đúng cách
		if (!DataBase || !DataBase.ZiUser || !ZiRank) {
			return await handleInitializationError(interaction, !DataBase);
		}

		const prediction = interaction.options.getInteger("prediction");
		let bet = interaction.options.getInteger("bet") || 100;
		const userId = interaction.user.id;
		const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

		// Xác thực số tiền cược
		if (bet <= 0) {
			return await showInvalidBetError(interaction);
		}

		if (bet > maxBet) {
			bet = maxBet;
		}

		await interaction.deferReply();

		// Show rolling animation
		await showRollingAnimation(interaction, userName, prediction, bet);

		// Roll the dice
		const dice1 = Math.floor(Math.random() * 6) + 1;
		const dice2 = Math.floor(Math.random() * 6) + 1;
		const total = dice1 + dice2;

		// Calculate result
		const isWin = total === prediction;
		const multiplier = calculateMultiplier(prediction, total);
		const winAmount = isWin ? Math.floor(bet * multiplier) : 0;
		const netGain = winAmount - bet;

		// Atomic transaction: check balance and update in one operation
		const userUpdate = await DataBase.ZiUser.findOneAndUpdate(
			{
				userID: userId,
				coin: { $gte: bet }, // Ensure sufficient balance
			},
			{ $inc: { coin: netGain } },
			{ new: true }, // Return updated document
		);

		if (!userUpdate) {
			// Either user doesn't exist or insufficient funds
			const userDB = await DataBase.ZiUser.findOne({ userID: userId });
			if (!userDB) {
				return await showUserNotFoundError(interaction);
			} else {
				return await showInsufficientFundsError(interaction, userDB.coin, bet);
			}
		}

		// Show final result
		await showDiceResult(interaction, dice1, dice2, total, prediction, bet, winAmount, netGain, isWin, multiplier);

		// Update quest progress for gambling wins
		if (isWin) {
			await updateQuestProgress(DataBase, userId, "gamble", 1);
		}

		// Give small XP for playing
		await ZiRank.execute({
			user: interaction.user,
			XpADD: isWin ? 10 : 3, // More XP for winning
			CoinADD: 0,
		});
	} catch (error) {
		console.error("Error in dice command:", error);
		await handleCommandError(interaction, error);
	}
};

function calculateMultiplier(prediction, actual) {
	// Exact match gives multiplier based on 2d6 probability (with ~5% house edge)
	if (prediction === actual) {
		// Multipliers based on actual 2d6 probabilities
		if (prediction === 2 || prediction === 12) return 34; // 1/36 chance
		if (prediction === 3 || prediction === 11) return 17; // 2/36 chance
		if (prediction === 4 || prediction === 10) return 11; // 3/36 chance
		if (prediction === 5 || prediction === 9) return 8.5; // 4/36 chance
		if (prediction === 6 || prediction === 8) return 6.8; // 5/36 chance
		if (prediction === 7) return 5.7; // 6/36 chance (most common)
	}
	return 0; // No match
}

async function showRollingAnimation(interaction, userName, prediction, bet) {
	const rollingEmbed = new EmbedBuilder()
		.setTitle(`${diceEmoji} Dice Roll Game`)
		.setColor("#FFD700")
		.setDescription(
			`${sparkleEmoji} **${userName}** đang lăn xúc xắc...\n\n🎯 **Dự đoán:** ${prediction}\n💰 **Cược:** ${bet.toLocaleString()} ZiGold\n\n🎲 **Rolling...** ${diceEmoji}${diceEmoji}`,
		)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: "Đang lăn xúc xắc...",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.editReply({ embeds: [rollingEmbed] });

	// Wait for dramatic effect
	await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function showDiceResult(interaction, dice1, dice2, total, prediction, bet, winAmount, netGain, isWin, multiplier) {
	const dice1Emoji = getDiceEmoji(dice1);
	const dice2Emoji = getDiceEmoji(dice2);

	let description = `${sparkleEmoji} **Kết quả:**\n\n`;
	description += `🎲 **Xúc xắc 1:** ${dice1Emoji} (${dice1})\n`;
	description += `🎲 **Xúc xắc 2:** ${dice2Emoji} (${dice2})\n`;
	description += `🎯 **Tổng điểm:** ${total}\n`;
	description += `🎯 **Dự đoán:** ${prediction}\n\n`;

	if (isWin) {
		description += `${trophyEmoji} **THẮNG!** ${fireEmoji}\n`;
		description += `💰 **Tiền thắng:** ${winAmount.toLocaleString()} ZiGold\n`;
		description += `📈 **Lợi nhuận:** +${netGain.toLocaleString()} ZiGold\n`;
		description += `⚡ **Multiplier:** x${multiplier}`;
	} else {
		description += `💸 **Thua rồi!** \n`;
		description += `📉 **Mất:** ${bet.toLocaleString()} ZiGold\n`;
		description += `🎯 **Chỉ cần:** ${Math.abs(total - prediction)} điểm nữa!`;
	}

	const embed = new EmbedBuilder()
		.setTitle(`${diceEmoji} Kết quả Dice Roll`)
		.setColor(isWin ? "#00FF00" : "#FF4757")
		.setDescription(description)
		.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
		.setFooter({
			text: `${isWin ? "Chúc mừng!" : "Thử lại lần sau!"} • +${isWin ? 10 : 3} XP`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	if (isWin && multiplier >= 17) {
		embed.addFields({
			name: `${fireEmoji} Bonus!`,
			value: `Dự đoán chính xác số khó! Multiplier cao: x${multiplier}`,
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}

function getDiceEmoji(value) {
	switch (value) {
		case 1:
			return "⚀";
		case 2:
			return "⚁";
		case 3:
			return "⚂";
		case 4:
			return "⚃";
		case 5:
			return "⚄";
		case 6:
			return "⚅";
		default:
			return "🎲";
	}
}

async function showInvalidBetError(interaction) {
	const embed = new EmbedBuilder().setTitle("❌ Lỗi cược").setColor("#FF4757").setDescription("Bạn không thể cược số tiền <= 0!");
	await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showUserNotFoundError(interaction) {
	const embed = new EmbedBuilder()
		.setTitle("❌ Người dùng không tìm thấy")
		.setColor("#FF4757")
		.setDescription("Không tìm thấy dữ liệu của bạn trong hệ thống. Hãy sử dụng một số lệnh khác trước!");
	await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showInsufficientFundsError(interaction, currentBalance, betAmount) {
	const embed = new EmbedBuilder()
		.setTitle("❌ Không đủ ZiGold")
		.setColor("#FF4757")
		.setDescription(
			`💸 **Bạn không có đủ ZiGold để cược!**\n\n💰 **Số dư hiện tại:** ${currentBalance.toLocaleString()} ZiGold\n🎯 **Số tiền cược:** ${betAmount.toLocaleString()} ZiGold\n🔍 **Thiếu:** ${(betAmount - currentBalance).toLocaleString()} ZiGold\n\n💡 Hãy đi săn bắn hoặc chơi các trò khác để kiếm thêm ZiGold!`,
		);
	await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleInitializationError(interaction, isDatabaseError) {
	const errorEmbed = new EmbedBuilder()
		.setTitle(`⚠️ ${sparkleEmoji} Khởi tạo hệ thống`)
		.setColor("#FFD700")
		.setDescription(
			isDatabaseError ?
				"🔄 **Đang khởi tạo database...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!"
			:	"🔄 **Đang khởi tạo functions...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!",
		)
		.setThumbnail(interaction.client.user.displayAvatarURL({ size: 1024 }))
		.setFooter({
			text: "Hệ thống đang được khởi tạo, vui lòng thử lại sau ít phút!",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	if (interaction.replied || interaction.deferred) {
		return await interaction.editReply({ embeds: [errorEmbed] });
	} else {
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}

async function handleCommandError(interaction, error) {
	console.error("Dice command error:", error);
	const errorEmbed = new EmbedBuilder()
		.setTitle("❌ Lỗi")
		.setColor("#FF0000")
		.setDescription("Có lỗi xảy ra khi chơi dice. Vui lòng thử lại!");

	if (interaction.replied || interaction.deferred) {
		return await interaction.editReply({ embeds: [errorEmbed] });
	} else {
		return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
	}
}
