const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");

const sellEmoji = "💰"; // Sell emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const gemEmoji = "💎"; // Gem emoji
const warningEmoji = "⚠️"; // Warning emoji

module.exports.data = {
    name: "S_sell_select",
    type: "selectmenu",
};

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import("../../lang/vi.js") } selectmenu.lang - language
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

        const selectedRarity = interaction.values[0];
        const userId = interaction.user.id;

        // Get user data
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        if (!userDB || !userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
            const noAnimalsEmbed = new EmbedBuilder()
                .setTitle(`${warningEmoji} Không có animals!`)
                .setColor("#FF6B9D")
                .setDescription("Bạn không có animals nào để bán!")
                .setFooter({ 
                    text: "Hãy hunt để có animals!", 
                    iconURL: interaction.client.user.displayAvatarURL() 
                });
            return await interaction.reply({ embeds: [noAnimalsEmbed], ephemeral: true });
        }

        if (selectedRarity === "all") {
            await confirmSellAll(interaction, userDB, DataBase, ZiRank);
        } else {
            await confirmSellRarity(interaction, userDB, selectedRarity, DataBase, ZiRank);
        }

    } catch (error) {
        console.error("Error in sell_select:", error);
        await handleSelectMenuError(interaction, error);
    }
};

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

async function confirmSellAll(interaction, userDB, DataBase, ZiRank) {
    const huntStats = userDB.huntStats || {};
    
    // Calculate total values
    let totalAnimals = 0;
    let totalValue = 0;
    const animalsByRarity = {};

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
            
            if (!animalsByRarity[rarity]) {
                animalsByRarity[rarity] = { count: 0, value: 0 };
            }
            
            animalsByRarity[rarity].count += count;
            animalsByRarity[rarity].value += value;
            totalAnimals += count;
            totalValue += value;
        }
    }

    if (totalAnimals === 0) {
        const noAnimalsEmbed = new EmbedBuilder()
            .setTitle(`${warningEmoji} Không có animals!`)
            .setColor("#FF6B9D")
            .setDescription("Bạn không có animals nào để bán!")
            .setFooter({ 
                text: "Hãy hunt để có animals!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [noAnimalsEmbed], ephemeral: true });
    }

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setTitle(`${warningEmoji} Xác nhận bán ALL animals!`)
        .setColor("#FF9800")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`**⚠️ CẢNH BÁO: BẠN SẮP BÁN TẤT CẢ ANIMALS!**\n\n${sparkleEmoji} **Tổng quan:**\n🦁 **Animals:** ${totalAnimals.toLocaleString()}\n${zigoldEmoji} **ZiGold nhận được:** ${totalValue.toLocaleString()}\n${gemEmoji} **XP Bonus:** +${Math.floor(totalValue * 0.1)}`);

    // Add rarity breakdown
    const rarityEmojis = {
        legendary: "💎",
        epic: "🔮", 
        rare: "⚡",
        uncommon: "🌟",
        common: "⚪"
    };

    let breakdownText = "";
    for (const [rarity, data] of Object.entries(animalsByRarity)) {
        breakdownText += `${rarityEmojis[rarity]} **${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:** ${data.count} animals (${data.value.toLocaleString()} ${zigoldEmoji})\n`;
    }
    
    confirmEmbed.addFields({
        name: `${sparkleEmoji} Breakdown by Rarity`,
        value: breakdownText,
        inline: false
    });

    confirmEmbed.setFooter({ 
        text: "⚠️ Hành động này KHÔNG THỂ HOÀN TÁC!", 
        iconURL: interaction.client.user.displayAvatarURL() 
    });

    // Generate a unique transaction ID to prevent race conditions
    const transactionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create confirmation buttons with simple custom IDs  
    const confirmButton = new ButtonBuilder()
        .setCustomId("confirm_sell_all")
        .setLabel("💸 YES, SELL ALL!")
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId("cancel_sell")
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(cancelButton, confirmButton);

    await interaction.update({ 
        embeds: [confirmEmbed], 
        components: [actionRow]
    });
}

async function confirmSellRarity(interaction, userDB, rarity, DataBase, ZiRank) {
    const huntStats = userDB.huntStats || {};
    
    // Find animals of specified rarity
    let totalAnimals = 0;
    let totalValue = 0;
    const animalsFound = [];

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
            
            animalsFound.push({
                name: animalData.name,
                emoji: animalData.emoji,
                count: count,
                value: value
            });
            
            totalAnimals += count;
            totalValue += value;
        }
    }

    if (animalsFound.length === 0) {
        const noAnimalsEmbed = new EmbedBuilder()
            .setTitle(`${warningEmoji} Không có animals ${rarity}!`)
            .setColor("#FF6B9D")
            .setDescription(`Bạn không có animals **${rarity}** nào để bán!`)
            .setFooter({ 
                text: "Hãy hunt để có thêm animals!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [noAnimalsEmbed], ephemeral: true });
    }

    // Create confirmation embed
    const rarityEmojis = {
        legendary: "💎",
        epic: "🔮", 
        rare: "⚡",
        uncommon: "🌟",
        common: "⚪"
    };

    const confirmEmbed = new EmbedBuilder()
        .setTitle(`${sellEmoji} Xác nhận bán ${rarityEmojis[rarity]} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} animals`)
        .setColor("#FF9800")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Bạn sắp bán tất cả animals ${rarity}!**\n\n🦁 **Animals:** ${totalAnimals}\n${zigoldEmoji} **ZiGold nhận được:** ${totalValue.toLocaleString()}\n${gemEmoji} **XP Bonus:** +${Math.floor(totalValue * 0.1)}`);

    // Add animals details (if not too many)
    if (animalsFound.length <= 8) {
        let animalDetails = "";
        for (const animal of animalsFound) {
            animalDetails += `${animal.emoji} **${animal.count}x** ${animal.name} - ${animal.value.toLocaleString()} ${zigoldEmoji}\n`;
        }
        confirmEmbed.addFields({
            name: `${sparkleEmoji} Animals to Sell`,
            value: animalDetails,
            inline: false
        });
    } else {
        confirmEmbed.addFields({
            name: `${sparkleEmoji} Animals to Sell`,
            value: `${animalsFound.length} different ${rarity} animals (${totalAnimals} total)`,
            inline: false
        });
    }

    confirmEmbed.setFooter({ 
        text: "⚠️ Hành động này không thể hoàn tác!", 
        iconURL: interaction.client.user.displayAvatarURL() 
    });

    // Generate a unique transaction ID to prevent race conditions
    const transactionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create confirmation buttons with simple custom IDs
    const confirmButton = new ButtonBuilder()
        .setCustomId("confirm_sell_rarity")
        .setLabel(`💰 Sell ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`)
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId("cancel_sell")
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(cancelButton, confirmButton);

    await interaction.update({ 
        embeds: [confirmEmbed], 
        components: [actionRow]
    });
}

async function handleSelectMenuError(interaction, error) {
    console.error("Sell select menu error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi xử lý sell menu. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}