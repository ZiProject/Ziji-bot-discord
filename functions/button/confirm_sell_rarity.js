const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");

const sellEmoji = "💰"; // Sell emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const gemEmoji = "💎"; // Gem emoji
const starEmoji = "⭐"; // Star emoji

module.exports.data = {
    name: "confirm_sell_rarity",
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

        // Extract rarity from embed title
        const embedTitle = interaction.message.embeds[0]?.title || "";
        const rarityMatch = embedTitle.match(/(common|uncommon|rare|epic|legendary)/i);
        const rarity = rarityMatch ? rarityMatch[1].toLowerCase() : null;
        
        if (!rarity) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Lỗi")
                .setColor("#FF4757")
                .setDescription("Không thể xác định rarity để bán!");
            return await interaction.update({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }

        // Immediately disable the button to prevent double-clicks
        const processingEmbed = new EmbedBuilder()
            .setTitle(`${sparkleEmoji} Processing ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Sale...`)
            .setColor("#FFD700")
            .setDescription(`🔄 **Đang xử lý việc bán ${rarity} animals...**\n\n⏳ Vui lòng đợi trong giây lát!`)
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

        // Perform atomic sale operation
        const saleResult = await performAtomicSaleRarity(DataBase, userId, rarity);
        
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

        // Rarity emojis and colors
        const rarityEmojis = {
            legendary: "💎",
            epic: "🔮", 
            rare: "⚡",
            uncommon: "🌟",
            common: "⚪"
        };

        const rarityColors = {
            legendary: "#FFD700",
            epic: "#9C27B0",
            rare: "#2196F3",
            uncommon: "#4CAF50",
            common: "#9E9E9E"
        };

        // Create success embed
        const successEmbed = new EmbedBuilder()
            .setTitle(`${sellEmoji} ${rarityEmojis[rarity]} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Sale Complete! ${sparkleEmoji}`)
            .setColor(rarityColors[rarity])
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`**Great sale!** You sold all your ${rarity} animals for an excellent price!`)
            .addFields(
                {
                    name: `${sellEmoji} Sale Summary`,
                    value: `🦁 **${saleResult.totalAnimals}** ${rarity} animals\n${zigoldEmoji} **+${saleResult.totalValue.toLocaleString()}** ZiGold`,
                    inline: true
                },
                {
                    name: `${starEmoji} Rewards`,
                    value: `${starEmoji} **+${xpReward}** XP\n🎯 **Rarity Cleared!**`,
                    inline: true
                },
                {
                    name: `${sparkleEmoji} New Balance`,
                    value: `${zigoldEmoji} **${saleResult.newBalance.toLocaleString()}** ZiGold`,
                    inline: true
                }
            )
            .setFooter({ 
                text: `💰 Excellent ${rarity} collection sale! • ZiBot Market`,
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Add details of what was sold (if not too many)
        if (saleResult.animalsSold && saleResult.animalsSold.length <= 6) {
            let soldDetails = "";
            for (const animal of saleResult.animalsSold) {
                soldDetails += `${animal.emoji} **${animal.count}x** ${animal.name} - ${animal.value.toLocaleString()} ${zigoldEmoji}\n`;
            }
            successEmbed.addFields({
                name: `${sparkleEmoji} Animals Sold`,
                value: soldDetails,
                inline: false
            });
        }

        // Add achievement message based on rarity and value
        let achievementText = "";
        if (rarity === "legendary" && saleResult.totalValue >= 30000) {
            achievementText = `**💎 LEGENDARY COLLECTOR!** - Massive legendary sale!`;
        } else if (rarity === "epic" && saleResult.totalValue >= 15000) {
            achievementText = `**🔮 EPIC TRADER!** - Amazing epic collection!`;
        } else if (rarity === "rare" && saleResult.totalValue >= 5000) {
            achievementText = `**⚡ RARE HUNTER!** - Impressive rare collection!`;
        } else if (saleResult.totalValue >= 1000) {
            achievementText = `**⭐ SMART TRADER!** - Great collection sale!`;
        }

        if (achievementText) {
            successEmbed.addFields({
                name: `${gemEmoji} Achievement`,
                value: achievementText,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error("Error in confirm_sell_rarity:", error);
        await handleButtonError(interaction, error);
    }
};

// Atomic sale operation for specific rarity
async function performAtomicSaleRarity(DataBase, userId, rarity) {
    try {
        // Generate unique transaction ID for this operation
        const transactionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // First, get current user data to compute sale value
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        if (!userDB || !userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
            return {
                success: false,
                title: "Không có animals!",
                message: `Bạn không còn animals **${rarity}** nào để bán!`,
                footer: "Animals đã được bán hoặc chuyển đi!"
            };
        }

        // Calculate what should be sold for this rarity
        const huntStats = userDB.huntStats || {};
        let totalAnimals = 0;
        let totalValue = 0;
        const animalEntries = [];
        const animalsSold = [];

        for (const [huntKey, huntData] of Object.entries(huntStats)) {
            if (!huntData || !huntData.count || huntData.count <= 0) continue;
            
            const parts = huntKey.split('_');
            const huntRarity = parts[0];
            const animalName = parts.slice(1).join('_');
            
            if (huntRarity !== rarity) continue;
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
                animalsSold.push({
                    name: animalData.name,
                    emoji: animalData.emoji,
                    count: count,
                    value: value
                });
            }
        }

        if (totalAnimals === 0) {
            return {
                success: false,
                title: "Không có animals!",
                message: `Bạn không còn animals **${rarity}** nào để bán!`,
                footer: "Animals đã được bán rồi!"
            };
        }

        // Build atomic update operations - set all animal counts to 0 for this rarity
        const setOperations = {};
        for (const entry of animalEntries) {
            setOperations[`huntStats.${entry.huntKey}.count`] = 0;
        }

        // Add transaction tracking to prevent duplicate processing
        setOperations[`lastSaleTransaction`] = transactionId;

        // Build condition that ensures inventory hasn't changed since we calculated totals
        const inventoryConditions = { 
            userID: userId,
            $or: [
                { lastSaleTransaction: { $exists: false } },
                { lastSaleTransaction: { $ne: transactionId } }
            ]
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
            newBalance: updateResult.coin,
            animalsSold,
            transactionId
        };

    } catch (error) {
        console.error("Atomic sale rarity operation error:", error);
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
            text: "Hệ thống sẽ sẵ sàng trong giây lát!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    return await interaction.update({ 
        embeds: [errorEmbed], 
        components: [] 
    });
}

async function handleButtonError(interaction, error) {
    console.error("Confirm sell rarity button error:", error);
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