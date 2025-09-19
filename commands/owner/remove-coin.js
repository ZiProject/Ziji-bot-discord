const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { useDB, useConfig } = require("@zibot/zihooks");
const { ZigoldManager, ZigoldTransactionLogger } = require("../../utils/zigoldManager");

const zigoldEmoji = "🪙"; // Biểu tượng ZiGold

module.exports.data = {
    name: "remove-coin",
    description: "Trừ ZiGold từ user (Chỉ Owner)",
    type: 1, // lệnh slash
    options: [
        {
            name: "user",
            description: "User cần trừ ZiGold",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "amount",
            description: "Số lượng ZiGold cần trừ (1 - 1,000,000)",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 1000000,
        },
        {
            name: "force",
            description: "Cho phép số dư âm (không bắt buộc)",
            type: ApplicationCommandOptionType.Boolean,
            required: false,
        },
        {
            name: "reason",
            description: "Lý do trừ ZiGold (không bắt buộc)",
            type: ApplicationCommandOptionType.String,
            required: false,
            max_length: 100,
        },
    ],
    integration_types: [0],
    contexts: [0],
};

module.exports.execute = async ({ interaction, lang }) => {
    const config = useConfig();
    const DataBase = useDB();

    // Kiểm tra quyền Owner
    if (!config.OwnerID.length || !config.OwnerID.includes(interaction.user.id)) {
        const noPermEmbed = new EmbedBuilder()
            .setTitle("❌ Không có quyền truy cập")
            .setColor("#FF0000")
            .setDescription("Chỉ có Owner bot mới được sử dụng lệnh này!")
            .setFooter({ text: "ZiBot • Access Denied" })
            .setTimestamp();
        
        return interaction.reply({ embeds: [noPermEmbed], ephemeral: true });
    }

    // Kiểm tra database
    if (!DataBase || !DataBase.ZiUser) {
        const dbErrorEmbed = new EmbedBuilder()
            .setTitle("❌ Lỗi Database")
            .setColor("#FF0000")
            .setDescription("Không thể kết nối đến database. Vui lòng thử lại sau!");
        
        return interaction.reply({ embeds: [dbErrorEmbed], ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const force = interaction.options.getBoolean("force") || false;
    const reason = interaction.options.getString("reason") || "Owner manual adjustment";

    try {
        // Validate user và amount
        await ZigoldManager.validateUser(targetUser);
        await ZigoldManager.validateAmount(amount);

        // Defer reply để có thời gian xử lý
        await interaction.deferReply();

        // Log transaction bắt đầu
        await ZigoldTransactionLogger.logTransaction(
            targetUser.id,
            amount,
            'SUBTRACT_START',
            interaction.user.id,
            reason,
            { command: 'remove-coin', force: force, guildId: interaction.guild?.id }
        );

        let updatedUser;
        let previousBalance = 0;

        if (force) {
            // Force mode: cho phép số dư âm, có thể tạo user mới
            const previousUser = await DataBase.ZiUser.findOne({ userID: targetUser.id });
            previousBalance = previousUser?.coin || 0;

            updatedUser = await DataBase.ZiUser.findOneAndUpdate(
                { userID: targetUser.id },
                { 
                    $inc: { coin: -amount },
                    $setOnInsert: { 
                        name: targetUser.username,
                        userID: targetUser.id,
                        xp: 0,
                        level: 1 
                    }
                },
                { 
                    new: true, 
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );
        } else {
            // Normal mode: chỉ trừ nếu đủ tiền, không tạo user mới
            updatedUser = await DataBase.ZiUser.findOneAndUpdate(
                { 
                    userID: targetUser.id, 
                    coin: { $gte: amount } // Chỉ trừ nếu đủ tiền
                },
                { 
                    $inc: { coin: -amount }
                },
                { 
                    new: true,
                    upsert: false // Không tạo user mới trong normal mode
                }
            );

            // Nếu không update được, có nghĩa là user không tồn tại hoặc không đủ tiền
            if (!updatedUser) {
                const existingUser = await DataBase.ZiUser.findOne({ userID: targetUser.id });
                if (!existingUser) {
                    throw new Error(`❌ **${targetUser.username}** không tồn tại trong database! Sử dụng force mode để tạo user với số dư âm.`);
                } else {
                    const currentBalance = existingUser.coin || 0;
                    throw new Error(`❌ **${targetUser.username}** không có đủ ZiGold để trừ! Số dư hiện tại: **${zigoldEmoji} ${currentBalance.toLocaleString()} ZiGold**`);
                }
            }

            // Tính previousBalance từ kết quả hiện tại
            previousBalance = (updatedUser.coin || 0) + amount;
        }

        // Đảm bảo có kết quả hợp lệ
        let finalUser = updatedUser;

        const newBalance = finalUser.coin;
        const userLevel = finalUser.level || 1;

        // Log transaction thành công
        await ZigoldTransactionLogger.logTransaction(
            targetUser.id,
            amount,
            'SUBTRACT_SUCCESS',
            interaction.user.id,
            reason,
            { 
                command: 'remove-coin', 
                force: force,
                guildId: interaction.guild?.id,
                newBalance: newBalance,
                previousBalance: previousBalance
            }
        );

        // Tạo embed thành công
        const successEmbed = await ZigoldManager.createSubtractSuccessEmbed(
            targetUser, 
            amount, 
            newBalance, 
            previousBalance,
            userLevel, 
            interaction.user
        );

        // Thêm thông tin về force mode
        if (force && newBalance < 0) {
            successEmbed.addFields({
                name: "⚠️ Force Mode",
                value: "Số dư âm được cho phép",
                inline: true
            });
        }

        // Gửi thông báo cho user (nếu có thể)
        const dmSent = await ZigoldManager.sendSubtractUserNotification(
            targetUser, 
            amount, 
            newBalance, 
            userLevel, 
            interaction.client.user
        );

        // Thêm thông tin về DM status
        if (dmSent) {
            successEmbed.addFields({
                name: "📨 Notification",
                value: "User đã được thông báo qua DM",
                inline: true
            });
        } else {
            successEmbed.addFields({
                name: "📨 Notification",
                value: "Không thể gửi DM cho user",
                inline: true
            });
        }

        await interaction.followUp({ embeds: [successEmbed] });

    } catch (error) {
        console.error("[REMOVE-COIN-ERROR]", error);

        // Log transaction thất bại
        await ZigoldTransactionLogger.logTransaction(
            targetUser.id,
            amount,
            'SUBTRACT_FAILED',
            interaction.user.id,
            reason,
            { 
                command: 'remove-coin', 
                force: force,
                error: error.message,
                guildId: interaction.guild?.id
            }
        );

        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Lỗi trừ ZiGold")
            .setColor("#FF0000")
            .setDescription(error.message || "Có lỗi xảy ra khi trừ ZiGold!")
            .addFields([
                { name: "👤 Target User", value: `${targetUser.username} (${targetUser.id})`, inline: true },
                { name: "💸 Amount", value: `${zigoldEmoji} ${amount.toLocaleString()} ZiGold`, inline: true },
                { name: "⚡ Force Mode", value: force ? "Enabled" : "Disabled", inline: true },
                { name: "🔍 Reason", value: reason, inline: false }
            ])
            .setFooter({ 
                text: `Admin: ${interaction.user.username} • ZiBot Error Log`,
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        const errorResponse = { embeds: [errorEmbed], ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorResponse).catch(() => {});
        } else {
            await interaction.reply(errorResponse).catch(() => {});
        }
    }
};