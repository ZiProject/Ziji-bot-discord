const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");

const sellEmoji = "💰"; // Sell emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const gemEmoji = "💎"; // Gem emoji
const starEmoji = "⭐"; // Star emoji

module.exports.data = {
    name: "confirm_sell_all",
    type: "button",
};

/**
 * @param { object } button - object button
 * @param { import("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import("../../lang/vi.js") } button.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
    try {
        const ZiRank = useFunctions().get("ZiRank");
        const DataBase = useDB();

        // Check if database and functions are properly initialized
        if (!DataBase || !DataBase.ZiUser || !ZiRank) {
            return await handleInitializationError(interaction, !DataBase);
        }

        // User verification is handled by Discord automatically for interactions

        // Immediately disable the button to prevent double-clicks
        const processingEmbed = new EmbedBuilder()
            .setTitle(`${sparkleEmoji} Processing Sale...`)
            .setColor("#FFD700")
            .setDescription(`🔄 **Đang xử lý việc bán animals...**\n\n⏳ Vui lòng đợi trong giây lát!`)
            .setFooter({ 
                text: "Đang thực hiện giao dịch an toàn...", 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.update({ 
            embeds: [processingEmbed], 
            components: [] // Remove all buttons immediately
        });

        const userId = interaction.user.id;

        // Perform atomic sale operation using MongoDB aggregation pipeline
        const saleResult = await performAtomicSaleAll(DataBase, userId);
        
        if (!saleResult.success) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ " + saleResult.title)
                .setColor("#FF4757")
                .setDescription(saleResult.message)
                .setFooter({ 
                    text: saleResult.footer, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            return await interaction.editReply({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }

        // Apply XP bonus through ZiRank (10% of ZiGold earned as XP)
        const xpReward = Math.floor(saleResult.totalValue * 0.1);
        try {
            await ZiRank.execute({ 
                user: interaction.user, 
                XpADD: xpReward,
                CoinADD: 0 // We already handled coins in the atomic update
            });
        } catch (rankError) {
            console.error("ZiRank error in sell:", rankError);
            // Continue with sale success even if ZiRank fails
        }

        // Create success embed
        const successEmbed = new EmbedBuilder()
            .setTitle(`${sellEmoji} MASSIVE SALE COMPLETE! ${sparkleEmoji}`)
            .setColor("#4CAF50")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`**🎉 CONGRATULATIONS!** You just sold your entire collection!\n\n**This was a HUGE sale!** ${gemEmoji}`)
            .addFields(
                {
                    name: `${sellEmoji} Total Sale`,
                    value: `🦁 **${saleResult.totalAnimals.toLocaleString()}** animals sold\n${zigoldEmoji} **+${saleResult.totalValue.toLocaleString()}** ZiGold earned`,
                    inline: true
                },
                {
                    name: `${starEmoji} Bonuses`,
                    value: `${starEmoji} **+${xpReward}** XP\n🏆 **Collection Cleared!**`,
                    inline: true
                },
                {
                    name: `${sparkleEmoji} New Balance`,
                    value: `${zigoldEmoji} **${saleResult.newBalance.toLocaleString()}** ZiGold`,
                    inline: true
                }
            )
            .setFooter({ 
                text: `🎯 Time to start hunting again! • ZiBot Market`,
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Add motivational message
        if (saleResult.totalValue >= 50000) {
            successEmbed.addFields({
                name: `${gemEmoji} ACHIEVEMENT UNLOCKED!`,
                value: `**💎 BIG SPENDER!** - Sold collection worth 50k+ ZiGold!`,
                inline: false
            });
        } else if (saleResult.totalValue >= 10000) {
            successEmbed.addFields({
                name: `${starEmoji} Great Sale!`,
                value: `**⭐ COLLECTOR!** - Impressive collection sale!`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error("Error in confirm_sell_all:", error);
        await handleButtonError(interaction, error);
    }
};

// Atomic sale operation that prevents race conditions
async function performAtomicSaleAll(DataBase, userId) {
    try {
        // First, get current user data to compute sale value
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        if (!userDB || !userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
            return {
                success: false,
                title: "Không có animals!",
                message: "Bạn không còn animals nào để bán!",
                footer: "Animals đã được bán hoặc chuyển đi!"
            };
        }

        // Calculate what should be sold
        const huntStats = userDB.huntStats || {};
        let totalAnimals = 0;
        let totalValue = 0;
        const animalEntries = [];

        for (const [huntKey, huntData] of Object.entries(huntStats)) {
            if (!huntData || !huntData.count || huntData.count <= 0) continue;
            
            const parts = huntKey.split('_');
            const rarity = parts[0];
            const animalName = parts.slice(1).join('_');
            
            if (!animals[rarity]) continue;
            
            const animalData = animals[rarity].find(a => a.name === animalName);
            if (animalData) {
                const count = huntData.count;
                const value = animalData.value * count;
                
                totalAnimals += count;
                totalValue += value;
                animalEntries.push({
                    huntKey,
                    count,
                    value
                });
            }
        }

        if (totalAnimals === 0) {
            return {
                success: false,
                title: "Không có animals!",
                message: "Bạn không còn animals nào để bán!",
                footer: "Animals đã được bán rồi!"
            };
        }

        // Build atomic update operations - set all animal counts to 0
        const setOperations = {};
        for (const entry of animalEntries) {
            setOperations[`huntStats.${entry.huntKey}.count`] = 0;
        }

        // Add transaction tracking to prevent duplicate processing
        // Remove transactionId tracking since we're using simple IDs now

        // Build condition that ensures inventory hasn't changed since we calculated totals
        const inventoryConditions = { 
            userID: userId
        };
        
        // Add conditions to verify animal counts are still as expected
        for (const entry of animalEntries) {
            inventoryConditions[`huntStats.${entry.huntKey}.count`] = { $gte: entry.count };
        }

        // Perform atomic update - only proceed if inventory state matches expectations
        const updateResult = await DataBase.ZiUser.findOneAndUpdate(
            inventoryConditions,
            {
                $inc: {
                    coin: totalValue,
                    totalAnimals: -totalAnimals
                },
                $set: setOperations
            },
            { new: true }
        );

        if (!updateResult) {
            return {
                success: false,
                title: "Giao dịch đã xử lý!",
                message: "Giao dịch này đã được xử lý rồi hoặc inventory đã thay đổi!",
                footer: "Vui lòng kiểm tra lại collection của bạn!"
            };
        }

        return {
            success: true,
            totalAnimals,
            totalValue,
            newBalance: updateResult.coin
        };

    } catch (error) {
        console.error("Atomic sale operation error:", error);
        return {
            success: false,
            title: "Lỗi hệ thống!",
            message: "Có lỗi xảy ra khi xử lý giao dịch. Vui lòng thử lại!",
            footer: "Nếu vấn đề tiếp tục, hãy liên hệ admin!"
        };
    }
}

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
    
    return await interaction.update({ 
        embeds: [errorEmbed], 
        components: [] 
    });
}

async function handleButtonError(interaction, error) {
    console.error("Confirm sell all button error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi bán animals. Vui lòng thử lại!");
    
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