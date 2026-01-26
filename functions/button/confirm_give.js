const { EmbedBuilder } = require("discord.js");
const { useHooks } = require("zihooks");
const animals = require("../../data/animals.json");

const giveEmoji = "🎁"; // Give emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const heartEmoji = "💖"; // Heart emoji
const arrowEmoji = "➡️"; // Arrow emoji

module.exports.data = {
	name: "confirm_give",
	type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
	// Check if useHooks is available
	if (!useHooks) {
		console.error("useHooks is not available");
		return (
			interaction?.reply?.({ content: "System is under maintenance, please try again later.", ephemeral: true }) ||
			console.error("No interaction available")
		);
	}
	try {
		const ZiRank = useHooks.get("functions").get("ZiRank");
		const DataBase = useHooks.get("db");

		// Check if database and functions are properly initialized
		if (!DataBase || !DataBase.ZiUser || !ZiRank) {
			return await handleInitializationError(interaction, !DataBase);
		}

		// Extract data from custom ID and verify ownership
		const customIdParts = interaction.customId.split(":");
		const giverId = customIdParts[1];
		const receiverId = customIdParts[2];
		const animalName = customIdParts[3];
		const amount = parseInt(customIdParts[4]);
		const transactionId = customIdParts[5];

		if (interaction.user.id !== giverId) {
			const errorEmbed = new EmbedBuilder()
				.setTitle("❌ Unauthorized")
				.setColor("#FF4757")
				.setDescription("Bạn không thể sử dụng button này!");
			return await interaction.update({
				embeds: [errorEmbed],
				components: [],
			});
		}

		// Immediately disable the button to prevent double-clicks
		const processingEmbed = new EmbedBuilder()
			.setTitle(`${sparkleEmoji} Processing Give...`)
			.setColor("#FFD700")
			.setDescription(`🔄 **Đang xử lý việc tặng animal...**\n\n⏳ Vui lòng đợi trong giây lát!`)
			.setFooter({
				text: "Đang thực hiện giao dịch an toàn...",
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setTimestamp();

		await interaction.update({
			embeds: [processingEmbed],
			components: [], // Remove all buttons immediately
		});

		// Get current data
		const [giverDB, receiverDB] = await Promise.all([
			DataBase.ZiUser.findOne({ userID: giverId }),
			DataBase.ZiUser.findOne({ userID: receiverId }),
		]);

		if (!giverDB || !giverDB.huntStats) {
			return await showTransactionError(interaction, "Người tặng không còn có animals!");
		}

		// Check daily give limit again
		const currentTime = new Date();
		const today = currentTime.toDateString();
		const lastGiveDate = giverDB.lastGive ? new Date(giverDB.lastGive).toDateString() : null;
		const dailyGives = lastGiveDate === today ? giverDB.dailyGives || 0 : 0;

		if (dailyGives >= 10) {
			return await showTransactionError(interaction, "Đã đạt giới hạn tặng hôm nay!");
		}

		// Find animal in giver's collection
		const animalLocation = findAnimalInCollection(giverDB.huntStats, animalName);
		if (!animalLocation) {
			return await showTransactionError(interaction, "Animal không còn tồn tại trong collection!");
		}

		if (animalLocation.count < amount) {
			return await showTransactionError(interaction, "Không đủ số lượng animal để tặng!");
		}

		// Perform atomic transaction
		const result = await performAtomicGive(
			DataBase,
			giverId,
			receiverId,
			animalLocation.rarity,
			animalName,
			amount,
			currentTime,
			dailyGives,
		);

		if (!result.success) {
			return await showTransactionError(interaction, result.error || "Giao dịch thất bại!");
		}

		// Get user objects for final display
		const giverUser = await interaction.client.users.fetch(giverId).catch(() => null);
		const receiverUser = await interaction.client.users.fetch(receiverId).catch(() => null);

		// Show success message
		await showGiveSuccess(
			interaction,
			giverUser,
			receiverUser,
			animalLocation,
			amount,
			result.giverNewCount,
			result.receiverNewCount,
		);

		// Give small XP reward to giver for being generous
		if (giverUser) {
			await ZiRank.execute({
				user: giverUser,
				XpADD: 5 * amount, // 5 XP per animal given
				CoinADD: 0,
			});
		}
	} catch (error) {
		console.error("Error in confirm_give:", error);
		await handleButtonError(interaction, error);
	}
};

function findAnimalInCollection(huntStats, animalName) {
	for (const [rarity, animalData] of Object.entries(huntStats)) {
		if (animals[rarity] && animalData[animalName] && animalData[animalName].count > 0) {
			const animalInfo = animals[rarity].find((a) => a.name === animalName);
			if (animalInfo) {
				return {
					...animalInfo,
					rarity: rarity,
					count: animalData[animalName].count,
				};
			}
		}
	}
	return null;
}

async function performAtomicGive(DataBase, giverId, receiverId, rarity, animalName, amount, currentTime, currentDailyGives) {
	const session = await DataBase.ZiUser.db.startSession();

	try {
		const result = await session.withTransaction(async () => {
			// Remove from giver
			const giverUpdate = await DataBase.ZiUser.findOneAndUpdate(
				{
					userID: giverId,
					[`huntStats.${rarity}.${animalName}.count`]: { $gte: amount },
				},
				{
					$inc: {
						[`huntStats.${rarity}.${animalName}.count`]: -amount,
						totalAnimals: -amount,
					},
					$set: {
						lastGive: currentTime,
						dailyGives: currentDailyGives + 1,
					},
				},
				{ session, new: true },
			);

			if (!giverUpdate) {
				throw new Error("Giver không có đủ animals hoặc dữ liệu đã thay đổi!");
			}

			// Add to receiver (create user if doesn't exist)
			const receiverUpdate = await DataBase.ZiUser.findOneAndUpdate(
				{ userID: receiverId },
				{
					$inc: {
						[`huntStats.${rarity}.${animalName}.count`]: amount,
						totalAnimals: amount,
					},
					$setOnInsert: {
						userID: receiverId,
						level: 1,
						xp: 1,
						coin: 1,
						huntStats: {},
					},
				},
				{
					session,
					new: true,
					upsert: true,
					setDefaultsOnInsert: true,
				},
			);

			return {
				giverNewCount: giverUpdate.huntStats[rarity][animalName].count,
				receiverNewCount: receiverUpdate.huntStats[rarity][animalName].count,
			};
		});

		return { success: true, ...result };
	} catch (error) {
		console.error("Transaction failed:", error);
		return { success: false, error: error.message };
	} finally {
		await session.endSession();
	}
}

async function showTransactionError(interaction, errorMessage) {
	const errorEmbed = new EmbedBuilder()
		.setTitle("❌ Giao dịch thất bại")
		.setColor("#FF4757")
		.setDescription(`**Lỗi:** ${errorMessage}\n\n🔄 Vui lòng thử lại nếu cần thiết!`)
		.setFooter({
			text: "Giao dịch đã được hủy để bảo đảm an toàn",
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.editReply({ embeds: [errorEmbed], components: [] });
}

async function showGiveSuccess(interaction, giverUser, receiverUser, animalInfo, amount, giverNewCount, receiverNewCount) {
	const totalValue = animalInfo.value * amount;
	const rarityEmojis = {
		common: "⚪",
		uncommon: "🟢",
		rare: "🔵",
		epic: "🟣",
		legendary: "🟡",
	};

	let description = `${sparkleEmoji} **Tặng animal thành công!**\n\n`;
	description += `${arrowEmoji} **Từ:** ${giverUser?.username || "Unknown"}\n`;
	description += `${arrowEmoji} **Đến:** ${receiverUser?.username || "Unknown"}\n\n`;
	description += `${animalInfo.emoji} **Animal:** ${animalInfo.name}\n`;
	description += `${rarityEmojis[animalInfo.rarity]} **Rarity:** ${animalInfo.rarity}\n`;
	description += `📊 **Số lượng:** ${amount}\n`;
	description += `💰 **Tổng giá trị:** ${totalValue.toLocaleString()} ZiGold\n\n`;
	description += `📈 **Số dư mới:**\n`;
	description += `• ${giverUser?.username || "Giver"}: ${giverNewCount}\n`;
	description += `• ${receiverUser?.username || "Receiver"}: ${receiverNewCount}\n\n`;
	description += `${heartEmoji} **Cảm ơn bạn đã chia sẻ!**`;

	const embed = new EmbedBuilder()
		.setTitle(`${giveEmoji} Animal Gift Completed`)
		.setColor("#00FF00")
		.setDescription(description)
		.setThumbnail(receiverUser?.displayAvatarURL({ dynamic: true }) || null)
		.setFooter({
			text: `Giao dịch hoàn tất • +${5 * amount} XP cho người tặng!`,
			iconURL: interaction.client.user.displayAvatarURL(),
		})
		.setTimestamp();

	await interaction.editReply({ embeds: [embed], components: [] });
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
		return await interaction.update({ embeds: [errorEmbed], components: [] });
	}
}

async function handleButtonError(interaction, error) {
	console.error("Confirm give button error:", error);
	const errorEmbed = new EmbedBuilder()
		.setTitle("❌ Lỗi")
		.setColor("#FF0000")
		.setDescription("Có lỗi xảy ra khi xử lý tặng animal. Vui lòng thử lại!");

	try {
		if (interaction.replied || interaction.deferred) {
			return await interaction.editReply({ embeds: [errorEmbed], components: [] });
		} else {
			return await interaction.update({ embeds: [errorEmbed], components: [] });
		}
	} catch (updateError) {
		console.error("Failed to update interaction after error:", updateError);
	}
}
