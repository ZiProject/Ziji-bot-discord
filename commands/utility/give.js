const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");

const zigoldEmoji = "🪙"; // ZiGold emoji
const giftEmoji = "🎁"; // Gift emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const heartEmoji = "💖"; // Heart emoji
const handshakeEmoji = "🤝"; // Handshake emoji

const MAX_GIVE_AMOUNT = 100000; // Maximum amount that can be given in one transaction
const MIN_GIVE_AMOUNT = 10; // Minimum amount to prevent spam
const GIVE_XP_REWARD = 5; // XP reward for giving (social interaction)

module.exports.data = {
        name: "give",
        description: "Tặng ZiGold cho user khác",
        type: 1,
        options: [
                {
                        name: "user",
                        description: "User mà bạn muốn tặng ZiGold",
                        type: 6,
                        required: true,
                },
                {
                        name: "amount",
                        description: `Số ZiGold muốn tặng (${MIN_GIVE_AMOUNT}-${MAX_GIVE_AMOUNT.toLocaleString()})`,
                        type: 4,
                        required: true,
                        min_value: MIN_GIVE_AMOUNT,
                        max_value: MAX_GIVE_AMOUNT,
                },
                {
                        name: "message",
                        description: "Lời nhắn kèm theo món quà (tùy chọn)",
                        type: 3,
                        required: false,
                        max_length: 200,
                },
        ],
        integration_types: [0, 1], // Guild app + User app  
        contexts: [0, 1, 2], // Guild + DM + Private channels
        dm_permission: true,
        nsfw: false,
};

/**
 * @param { object } command - object command
 * @param { import("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import("../../lang/vi.js") } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
        try {
                const ZiRank = useFunctions().get("ZiRank");
                const DataBase = useDB();

                // Check if database and functions are properly initialized
                if (!DataBase || !DataBase.ZiUser || !ZiRank) {
                        return await handleInitializationError(interaction, !DataBase);
                }

                const targetUser = interaction.options.getUser("user");
                const amount = interaction.options.getInteger("amount");
                const message = interaction.options.getString("message") || "";
                
                const senderName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
                const receiverName = targetUser.member?.displayName ?? targetUser.globalName ?? targetUser.username;

                // Validation checks
                const validationError = validateGiveRequest(interaction.user, targetUser, amount);
                if (validationError) {
                        return await interaction.reply({ embeds: [validationError], ephemeral: true });
                }

                // Defer reply for processing time
                await interaction.deferReply();

                // Get both users' current data
                const [senderDB, receiverDB] = await Promise.all([
                        DataBase.ZiUser.findOne({ userID: interaction.user.id }),
                        DataBase.ZiUser.findOne({ userID: targetUser.id })
                ]);

                const senderBalance = senderDB?.coin || 0;

                // Check if sender has enough ZiGold
                if (senderBalance < amount) {
                        const insufficientEmbed = new EmbedBuilder()
                                .setTitle(`${zigoldEmoji} Không đủ ZiGold`)
                                .setColor("#FF6B6B")
                                .setDescription(`Bạn không có đủ ZiGold để tặng!\n\n${zigoldEmoji} **Số dư hiện tại:** ${senderBalance.toLocaleString()} ZiGold\n${giftEmoji} **Số tiền muốn tặng:** ${amount.toLocaleString()} ZiGold\n${sparkleEmoji} **Cần thêm:** ${(amount - senderBalance).toLocaleString()} ZiGold`)
                                .addFields({
                                        name: "💡 Gợi ý",
                                        value: "Chơi các trò chơi như `/hunt`, `/daily`, `/coinflip` để kiếm thêm ZiGold!"
                                })
                                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                                .setFooter({ 
                                        text: "ZiBot • Give System", 
                                        iconURL: interaction.client.user.displayAvatarURL() 
                                })
                                .setTimestamp();

                        return await interaction.editReply({ embeds: [insufficientEmbed] });
                }

                // Perform atomic transfer
                const transferResult = await performAtomicTransfer(DataBase, interaction.user.id, targetUser.id, amount);
                
                if (!transferResult.success) {
                        const errorEmbed = new EmbedBuilder()
                                .setTitle("❌ Lỗi giao dịch")
                                .setColor("#FF0000")
                                .setDescription("Không thể thực hiện giao dịch. Có thể số dư đã thay đổi hoặc có lỗi hệ thống.")
                                .setFooter({ 
                                        text: "Vui lòng thử lại sau", 
                                        iconURL: interaction.client.user.displayAvatarURL() 
                                });

                        return await interaction.editReply({ embeds: [errorEmbed] });
                }

                // Award XP to sender for social interaction (using ZiRank)
                let senderLang = lang;
                try {
                        senderLang = await ZiRank.execute({ 
                                user: interaction.user, 
                                XpADD: GIVE_XP_REWARD, 
                                CoinADD: 0 
                        });
                } catch (error) {
                        console.error("Error calling ZiRank for sender:", error);
                }

                // Award small XP to receiver for social interaction
                try {
                        await ZiRank.execute({ 
                                user: targetUser, 
                                XpADD: 2, 
                                CoinADD: 0 
                        });
                } catch (error) {
                        console.error("Error calling ZiRank for receiver:", error);
                }

                // Get updated balances
                const [updatedSender, updatedReceiver] = await Promise.all([
                        DataBase.ZiUser.findOne({ userID: interaction.user.id }),
                        DataBase.ZiUser.findOne({ userID: targetUser.id })
                ]);

                // Success embed for the channel
                const successEmbed = new EmbedBuilder()
                        .setTitle(`${giftEmoji} Tặng ZiGold thành công! ${heartEmoji}`)
                        .setColor("#00D4AA")
                        .setDescription(
                                `**${senderName}** đã tặng **${amount.toLocaleString()} ZiGold** ${zigoldEmoji} cho **${receiverName}**!` +
                                (message ? `\n\n${sparkleEmoji} **Lời nhắn:** *"${message}"*` : "")
                        )
                        .addFields(
                                {
                                        name: `${handshakeEmoji} Giao dịch`,
                                        value: `**${amount.toLocaleString()}** ZiGold ${zigoldEmoji}`,
                                        inline: true
                                },
                                {
                                        name: `💰 Số dư mới của ${senderName}`,
                                        value: `${updatedSender.coin.toLocaleString()} ZiGold`,
                                        inline: true
                                },
                                {
                                        name: `💎 Số dư mới của ${receiverName}`,
                                        value: `${updatedReceiver.coin.toLocaleString()} ZiGold`,
                                        inline: true
                                }
                        )
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setFooter({ 
                                text: `${senderName} đã được +${GIVE_XP_REWARD} XP • ZiBot Give System`, 
                                iconURL: interaction.user.displayAvatarURL() 
                        })
                        .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // Send DM notification to receiver
                await sendReceiverNotification(targetUser, interaction.user, amount, message, updatedReceiver.coin);

        } catch (error) {
                console.error("Error in give command:", error);
                await handleCommandError(interaction, error);
        }
};

// Helper Functions

async function handleInitializationError(interaction, isDatabaseError) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`⚠️ ${sparkleEmoji} Khởi tạo hệ thống`)
                .setColor("#FFD700")
                .setDescription(
                        isDatabaseError 
                        ? `🔄 **Database đang khởi tạo...**\n\n${sparkleEmoji} Vui lòng đợi vài giây rồi thử lại!`
                        : `🔄 **Hệ thống ZiRank đang khởi tạo...**\n\n${sparkleEmoji} Vui lòng đợi vài giây rồi thử lại!`
                )
                .setFooter({ 
                        text: "Hệ thống sẽ sẵn sàng trong giây lát!", 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
        
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

function validateGiveRequest(sender, receiver, amount) {
        // Can't give to yourself
        if (sender.id === receiver.id) {
                return new EmbedBuilder()
                        .setTitle("❌ Không thể tự tặng")
                        .setColor("#FF6B6B")
                        .setDescription("Bạn không thể tự tặng ZiGold cho chính mình!");
        }

        // Can't give to bots
        if (receiver.bot) {
                return new EmbedBuilder()
                        .setTitle("❌ Không thể tặng bot")
                        .setColor("#FF6B6B")
                        .setDescription("Bạn không thể tặng ZiGold cho bot!");
        }

        // Amount validation (additional check)
        if (amount < MIN_GIVE_AMOUNT || amount > MAX_GIVE_AMOUNT) {
                return new EmbedBuilder()
                        .setTitle("❌ Số tiền không hợp lệ")
                        .setColor("#FF6B6B")
                        .setDescription(`Số ZiGold phải trong khoảng ${MIN_GIVE_AMOUNT.toLocaleString()} - ${MAX_GIVE_AMOUNT.toLocaleString()}!`);
        }

        return null; // No validation errors
}

async function performAtomicTransfer(DataBase, senderId, receiverId, amount) {
        try {
                // Start MongoDB session for transaction
                const session = await DataBase.ZiUser.db.startSession();
                let success = false;

                await session.withTransaction(async () => {
                        // Deduct from sender (atomic check and update)
                        const senderUpdate = await DataBase.ZiUser.findOneAndUpdate(
                                { 
                                        userID: senderId, 
                                        coin: { $gte: amount } // Only proceed if sufficient balance
                                },
                                { $inc: { coin: -amount } },
                                { new: true, session }
                        );

                        if (!senderUpdate) {
                                throw new Error("Insufficient balance or sender not found");
                        }

                        // Add to receiver (create if doesn't exist)
                        await DataBase.ZiUser.findOneAndUpdate(
                                { userID: receiverId },
                                { 
                                        $inc: { coin: amount },
                                        $setOnInsert: {
                                                userID: receiverId,
                                                xp: 1,
                                                level: 1
                                        }
                                },
                                { upsert: true, new: true, session }
                        );

                        success = true;
                });

                await session.endSession();
                return { success };

        } catch (error) {
                console.error("Atomic transfer error:", error);
                return { success: false, error: error.message };
        }
}

async function sendReceiverNotification(receiver, sender, amount, message, newBalance) {
        try {
                const senderName = sender.member?.displayName ?? sender.globalName ?? sender.username;
                
                const dmEmbed = new EmbedBuilder()
                        .setTitle(`${giftEmoji} Bạn nhận được ZiGold! ${heartEmoji}`)
                        .setColor("#00D4AA")
                        .setDescription(
                                `**${senderName}** đã tặng bạn **${amount.toLocaleString()} ZiGold** ${zigoldEmoji}!` +
                                (message ? `\n\n${sparkleEmoji} **Lời nhắn:** *"${message}"*` : "")
                        )
                        .addFields(
                                { 
                                        name: `${zigoldEmoji} Số tiền nhận được`, 
                                        value: `${amount.toLocaleString()} ZiGold`, 
                                        inline: true 
                                },
                                { 
                                        name: `💰 Số dư mới của bạn`, 
                                        value: `${newBalance.toLocaleString()} ZiGold`, 
                                        inline: true 
                                }
                        )
                        .setThumbnail(sender.displayAvatarURL({ dynamic: true }))
                        .setFooter({ 
                                text: "ZiBot • Give System", 
                                iconURL: sender.client.user.displayAvatarURL() 
                        })
                        .setTimestamp();

                await receiver.send({ embeds: [dmEmbed] });
        } catch (error) {
                console.log(`Could not send DM to ${receiver.username}: ${error.message}`);
        }
}

async function handleCommandError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Lỗi hệ thống")
                .setColor("#FF0000")
                .setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại sau!")
                .setFooter({ 
                        text: "Nếu lỗi tiếp tục, hãy liên hệ admin", 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
        
        const errorResponse = { embeds: [errorEmbed], ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse).catch(() => {});
        } else {
                await interaction.reply(errorResponse).catch(() => {});
        }
}