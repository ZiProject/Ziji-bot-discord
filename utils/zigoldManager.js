const { EmbedBuilder } = require("discord.js");
const { ZiUser } = require("../models/mongoDB");

// ZiGold emoji
const zigoldEmoji = "🪙";

// Transaction model for audit logging - you could create a separate collection for this
// For now we'll use console logging with structured data that could be easily moved to DB
class ZigoldTransactionLogger {
	static async logTransaction(userID, amount, type, adminID, reason = "Admin operation", additionalData = {}) {
		try {
			const transactionRecord = {
				timestamp: new Date().toISOString(),
				userID,
				adminID,
				type, // ADD_START, ADD_SUCCESS, ADD_FAILED, SUBTRACT_START, SUBTRACT_SUCCESS, SUBTRACT_FAILED
				amount,
				reason,
				...additionalData,
			};

			// TODO: Replace with actual database logging to a Transaction collection
			// Example: await TransactionLog.create(transactionRecord);
			console.log(`[ZIGOLD-TRANSACTION] ${JSON.stringify(transactionRecord)}`);

			return transactionRecord;
		} catch (error) {
			console.error("[ZIGOLD-LOG-ERROR] Failed to log transaction:", error);
		}
	}
}

// Utility functions for Zigold operations
class ZigoldManager {
	static async validateUser(user) {
		if (!user || user.bot) {
			throw new Error("❌ User không hợp lệ hoặc là bot!");
		}
		return true;
	}

	static async validateAmount(amount) {
		if (!amount || amount <= 0 || amount > 1000000) {
			throw new Error("❌ Số lượng ZiGold phải từ 1 đến 1,000,000!");
		}
		return true;
	}

	static async createSuccessEmbed(targetUser, amount, newBalance, level, adminUser) {
		return new EmbedBuilder()
			.setTitle(`${zigoldEmoji} ZiGold Added Successfully!`)
			.setColor("#00FF00")
			.setDescription(`**${targetUser.username}** đã nhận được **${zigoldEmoji} ${amount.toLocaleString()} ZiGold**!`)
			.addFields(
				{ name: "👤 Target User", value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: "💎 Amount Added", value: `${zigoldEmoji} ${amount.toLocaleString()} ZiGold`, inline: true },
				{ name: "💰 New Balance", value: `${zigoldEmoji} ${newBalance.toLocaleString()} ZiGold`, inline: true },
				{ name: "📊 Level", value: `${level || 1}`, inline: true },
				{ name: "🔒 Security", value: `Transaction logged`, inline: true },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
			)
			.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
			.setFooter({
				text: `Admin: ${adminUser.username} • ZiBot Secure Transaction`,
				iconURL: adminUser.displayAvatarURL(),
			})
			.setTimestamp();
	}

	static async sendUserNotification(targetUser, amount, newBalance, level, clientUser) {
		try {
			const dmEmbed = new EmbedBuilder()
				.setTitle(`🎉 You Received ${zigoldEmoji} ZiGold!`)
				.setColor("#FFD700")
				.setDescription(`Bạn đã nhận được **${zigoldEmoji} ${amount.toLocaleString()} ZiGold** từ admin!`)
				.addFields(
					{ name: "💰 New Balance", value: `${zigoldEmoji} ${newBalance.toLocaleString()} ZiGold`, inline: true },
					{ name: "📊 Your Level", value: `${level || 1}`, inline: true },
					{ name: "🔐 Secure Transaction", value: "Verified & Logged", inline: true },
				)
				.setThumbnail(clientUser.displayAvatarURL())
				.setFooter({ text: "ZiBot • Secure ZiGold System" })
				.setTimestamp();

			await targetUser.send({ embeds: [dmEmbed] });
			return true;
		} catch (dmError) {
			console.log(`[ZIGOLD-DM] Could not notify user ${targetUser.username}: ${dmError.message}`);
			return false;
		}
	}

	static async checkUserBalance(userID) {
		const user = await ZiUser.findOne({ userID });
		if (!user) {
			throw new Error("❌ User không tồn tại trong database!");
		}
		return { user, balance: user.coin || 0 };
	}

	static async validateSufficientFunds(balance, amount, username) {
		if (balance < amount) {
			throw new Error(
				`❌ **${username}** chỉ có **${zigoldEmoji} ${balance.toLocaleString()} ZiGold**, không thể trừ **${zigoldEmoji} ${amount.toLocaleString()} ZiGold**!`,
			);
		}
		return true;
	}

	static async createSubtractSuccessEmbed(targetUser, amount, newBalance, previousBalance, level, adminUser) {
		return new EmbedBuilder()
			.setTitle(`💸 ZiGold Subtracted Successfully!`)
			.setColor("#FF6B6B")
			.setDescription(`**${zigoldEmoji} ${amount.toLocaleString()} ZiGold** đã được trừ từ **${targetUser.username}**!`)
			.addFields(
				{ name: "👤 Target User", value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: "💸 Amount Subtracted", value: `${zigoldEmoji} ${amount.toLocaleString()} ZiGold`, inline: true },
				{ name: "💰 New Balance", value: `${zigoldEmoji} ${newBalance.toLocaleString()} ZiGold`, inline: true },
				{ name: "📊 Level", value: `${level || 1}`, inline: true },
				{ name: "🔄 Previous Balance", value: `${zigoldEmoji} ${previousBalance.toLocaleString()} ZiGold`, inline: true },
				{ name: "🔒 Security", value: `Transaction verified & logged`, inline: true },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
			)
			.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
			.setFooter({
				text: `Admin: ${adminUser.username} • ZiBot Secure Transaction`,
				iconURL: adminUser.displayAvatarURL(),
			})
			.setTimestamp();
	}

	static async sendSubtractUserNotification(targetUser, amount, newBalance, level, clientUser) {
		try {
			const dmEmbed = new EmbedBuilder()
				.setTitle(`💸 ${zigoldEmoji} ZiGold Deducted`)
				.setColor("#FFA500")
				.setDescription(`**${zigoldEmoji} ${amount.toLocaleString()} ZiGold** đã được trừ từ tài khoản của bạn.`)
				.addFields(
					{ name: "💰 New Balance", value: `${zigoldEmoji} ${newBalance.toLocaleString()} ZiGold`, inline: true },
					{ name: "📊 Your Level", value: `${level || 1}`, inline: true },
					{ name: "🔐 Secure Transaction", value: "Verified & Logged", inline: true },
					{ name: "📞 Support", value: "Contact admin if you have questions", inline: false },
				)
				.setThumbnail(clientUser.displayAvatarURL())
				.setFooter({ text: "ZiBot • Secure ZiGold System" })
				.setTimestamp();

			await targetUser.send({ embeds: [dmEmbed] });
			return true;
		} catch (dmError) {
			console.log(`[ZIGOLD-SUBTRACT-DM] Could not notify user ${targetUser.username}: ${dmError.message}`);
			return false;
		}
	}
}

module.exports = { ZigoldManager, ZigoldTransactionLogger };
