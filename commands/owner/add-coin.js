const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { useDB, useConfig } = require("@zibot/zihooks");
const { ZigoldManager, ZigoldTransactionLogger } = require("../../utils/zigoldManager");

const zigoldEmoji = "🪙"; // Biểu tượng ZiGold

module.exports.data = {
    name: "add-coin",
    description: "Thêm ZiGold cho user (Chỉ Owner)",
    type: 1, // lệnh slash
    options: [
        {
            name: "user",
            description: "User cần thêm ZiGold",
            type: ApplicationCommandOptionType.User,
            required: true,
        },
        {
            name: "amount",
            description: "Số lượng ZiGold cần thêm (1 - 1,000,000)",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
            max_value: 1000000,
        },
        {
            name: "reason",
            description: "Lý do thêm ZiGold (không bắt buộc)",
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
            'ADD_START',
            interaction.user.id,
            reason,
            { command: 'add-coin', guildId: interaction.guild?.id }
        );

        // Thực hiện thêm ZiGold với atomic operation
        const updatedUser = await DataBase.ZiUser.findOneAndUpdate(
            { userID: targetUser.id },
            { 
                $inc: { coin: amount },
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

        if (!updatedUser) {
            throw new Error("Không thể cập nhật database!");
        }

        const newBalance = updatedUser.coin;
        const userLevel = updatedUser.level || 1;

        // Log transaction thành công
        await ZigoldTransactionLogger.logTransaction(
            targetUser.id,
            amount,
            'ADD_SUCCESS',
            interaction.user.id,
            reason,
            { 
                command: 'add-coin', 
                guildId: interaction.guild?.id,
                newBalance: newBalance,
                previousBalance: newBalance - amount
            }
        );

        // Tạo embed thành công
        const successEmbed = await ZigoldManager.createSuccessEmbed(
            targetUser, 
            amount, 
            newBalance, 
            userLevel, 
            interaction.user
        );

        // Gửi thông báo cho user (nếu có thể)
        const dmSent = await ZigoldManager.sendUserNotification(
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
        console.error("[ADD-COIN-ERROR]", error);

        // Log transaction thất bại
        await ZigoldTransactionLogger.logTransaction(
            targetUser.id,
            amount,
            'ADD_FAILED',
            interaction.user.id,
            reason,
            { 
                command: 'add-coin', 
                error: error.message,
                guildId: interaction.guild?.id
            }
        );

        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Lỗi thêm ZiGold")
            .setColor("#FF0000")
            .setDescription(error.message || "Có lỗi xảy ra khi thêm ZiGold!")
            .addFields([
                { name: "👤 Target User", value: `${targetUser.username} (${targetUser.id})`, inline: true },
                { name: "💎 Amount", value: `${zigoldEmoji} ${amount.toLocaleString()} ZiGold`, inline: true },
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