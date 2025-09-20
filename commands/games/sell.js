const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");

const sellEmoji = "💰"; // Sell emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const gemEmoji = "💎"; // Gem emoji
const crownEmoji = "👑"; // Crown emoji
const starEmoji = "⭐"; // Star emoji
const trashEmoji = "🗑️"; // Trash emoji

module.exports.data = {
    name: "sell",
    description: "Bán animals từ collection của bạn để kiếm ZiGold!",
    type: 1,
    options: [
        {
            type: 3,
            name: "rarity",
            description: "Độ hiếm của animals muốn bán",
            required: false,
            choices: [
                { name: "All Common", value: "common" },
                { name: "All Uncommon", value: "uncommon" },
                { name: "All Rare", value: "rare" },
                { name: "All Epic", value: "epic" },
                { name: "All Legendary", value: "legendary" }
            ]
        },
        {
            type: 4,
            name: "amount",
            description: "Số lượng animals muốn bán (dùng với rarity)",
            required: false,
            min_value: 1,
            max_value: 1000
        }
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

        const userId = interaction.user.id;
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
        const rarity = interaction.options?.getString("rarity");
        const amount = interaction.options?.getInteger("amount");

        // Get user data
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        if (!userDB || !userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
            return await showEmptyCollection(interaction, userName);
        }

        if (rarity) {
            // Sell by rarity
            await sellByRarity(interaction, userDB, rarity, amount, DataBase, ZiRank);
        } else {
            // Show sell menu
            await showSellMenu(interaction, userDB, userName);
        }

    } catch (error) {
        console.error("Error in sell command:", error);
        await handleCommandError(interaction, error);
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

async function showEmptyCollection(interaction, userName) {
    const emptyEmbed = new EmbedBuilder()
        .setTitle(`${trashEmoji} Collection trống!`)
        .setColor("#FF6B9D")
        .setDescription(`**${userName}**, bạn chưa có animals nào để bán!\n\n🏹 Hãy sử dụng \`\`\`text\n/hunt\n\`\`\` để thu thập animals trước!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: "Hãy hunt để có animals bán!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();
        
    return await interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
}

async function showSellMenu(interaction, userDB, userName) {
    const huntStats = userDB.huntStats || {};
    
    // Calculate collection stats
    const rarityStats = {
        common: { count: 0, value: 0 },
        uncommon: { count: 0, value: 0 },
        rare: { count: 0, value: 0 },
        epic: { count: 0, value: 0 },
        legendary: { count: 0, value: 0 }
    };

    let totalAnimals = 0;
    let totalValue = 0;

    // Process hunt stats
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
            
            rarityStats[rarity].count += count;
            rarityStats[rarity].value += value;
            totalAnimals += count;
            totalValue += value;
        }
    }

    if (totalAnimals === 0) {
        return await showEmptyCollection(interaction, userName);
    }

    // Create sell menu embed
    const embed = new EmbedBuilder()
        .setTitle(`${sellEmoji} Animal Market - ${userName}`)
        .setColor("#4CAF50")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`${sparkleEmoji} **Chọn rarity để bán animals!**\n\n**${crownEmoji} Collection Overview:**\n${zigoldEmoji} **Total Value:** \`${totalValue.toLocaleString()}\` ZiGold\n🦁 **Total Animals:** \`${totalAnimals.toLocaleString()}\``)
        .setFooter({ 
            text: "💡 Chọn một option để bán toàn bộ animals của rarity đó!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    // Add rarity fields
    const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    const rarityEmojis = {
        legendary: "💎",
        epic: "🔮", 
        rare: "⚡",
        uncommon: "🌟",
        common: "⚪"
    };

    for (const rarity of rarityOrder) {
        if (rarityStats[rarity].count > 0) {
            embed.addFields({
                name: `${rarityEmojis[rarity]} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`,
                value: `**Count:** ${rarityStats[rarity].count}\n**Value:** ${zigoldEmoji} ${rarityStats[rarity].value.toLocaleString()}`,
                inline: true
            });
        }
    }

    // Create select menu for selling
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("S_sell_select")
        .setPlaceholder("🎯 Chọn rarity để bán...")
        .setMinValues(1)
        .setMaxValues(1);

    // Add options for each rarity that has animals
    for (const rarity of rarityOrder) {
        if (rarityStats[rarity].count > 0) {
            selectMenu.addOptions({
                label: `Sell All ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`,
                description: `${rarityStats[rarity].count} animals • ${rarityStats[rarity].value.toLocaleString()} ZiGold`,
                value: rarity,
                emoji: rarityEmojis[rarity]
            });
        }
    }

    // Add sell all option
    selectMenu.addOptions({
        label: "💸 Sell Everything",
        description: `All ${totalAnimals} animals • ${totalValue.toLocaleString()} ZiGold`,
        value: "all",
        emoji: "💸"
    });

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ 
        embeds: [embed], 
        components: [actionRow] 
    });
}

async function sellByRarity(interaction, userDB, rarity, amount, DataBase, ZiRank) {
    const huntStats = userDB.huntStats || {};
    const userId = interaction.user.id;
    
    // Find animals of specified rarity
    const animalsSold = [];
    let totalZigoldEarned = 0;
    let totalAnimalsSold = 0;
    let soldStats = {};

    for (const [huntKey, huntData] of Object.entries(huntStats)) {
        if (!huntData || !huntData.count || huntData.count <= 0) continue;
        
        const parts = huntKey.split('_');
        const huntRarity = parts[0];
        const animalName = parts.slice(1).join('_');
        
        if (huntRarity !== rarity) continue;
        if (!animals[rarity]) continue;
        
        const animalData = animals[rarity].find(a => a.name === animalName);
        if (!animalData) continue;

        const availableCount = huntData.count;
        const sellCount = amount ? Math.min(amount - totalAnimalsSold, availableCount) : availableCount;
        
        if (sellCount <= 0) continue;

        const zigoldEarned = animalData.value * sellCount;
        totalZigoldEarned += zigoldEarned;
        totalAnimalsSold += sellCount;

        animalsSold.push({
            name: animalData.name,
            emoji: animalData.emoji,
            count: sellCount,
            value: zigoldEarned,
            huntKey: huntKey
        });

        soldStats[huntKey] = sellCount;

        if (amount && totalAnimalsSold >= amount) break;
    }

    if (animalsSold.length === 0) {
        const noAnimalsEmbed = new EmbedBuilder()
            .setTitle(`${trashEmoji} Không có animals để bán!`)
            .setColor("#FF6B9D")
            .setDescription(`Bạn không có animals **${rarity}** nào để bán!`)
            .setFooter({ 
                text: "Hãy hunt để có thêm animals!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [noAnimalsEmbed], ephemeral: true });
    }

    // Perform the sale - atomic update
    const updateOperations = {};
    for (const [huntKey, sellCount] of Object.entries(soldStats)) {
        updateOperations[`huntStats.${huntKey}.count`] = -sellCount;
    }

    const saleResult = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId },
        {
            $inc: {
                coin: totalZigoldEarned,
                totalAnimals: -totalAnimalsSold,
                ...updateOperations
            }
        },
        { new: true }
    );

    if (!saleResult) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Lỗi bán animals!")
            .setColor("#FF4757")
            .setDescription("Có lỗi xảy ra khi bán animals. Vui lòng thử lại!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Apply XP bonus through ZiRank (10% of ZiGold earned as XP)
    const xpReward = Math.floor(totalZigoldEarned * 0.1);
    await ZiRank.execute({ 
        user: interaction.user, 
        XpADD: xpReward,
        CoinADD: 0 // We already handled coins above
    });

    // Create success embed
    const successEmbed = new EmbedBuilder()
        .setTitle(`${sellEmoji} Sale Successful! ${sparkleEmoji}`)
        .setColor("#4CAF50")
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Congratulations!** You sold your animals for a great price!`)
        .addFields(
            {
                name: `${gemEmoji} Animals Sold`,
                value: `**${totalAnimalsSold}** ${rarity} animals`,
                inline: true
            },
            {
                name: `${zigoldEmoji} ZiGold Earned`,
                value: `**+${totalZigoldEarned.toLocaleString()}** ZiGold`,
                inline: true
            },
            {
                name: `${starEmoji} XP Bonus`,
                value: `**+${xpReward}** XP`,
                inline: true
            }
        )
        .setFooter({ 
            text: `💰 New balance: ${saleResult.coin.toLocaleString()} ZiGold • ZiBot Market`,
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    // Add details of what was sold
    if (animalsSold.length <= 5) {
        let soldDetails = "";
        for (const animal of animalsSold) {
            soldDetails += `${animal.emoji} **${animal.count}x** ${animal.name} - ${animal.value.toLocaleString()} ${zigoldEmoji}\n`;
        }
        successEmbed.addFields({
            name: `${sparkleEmoji} Sale Details`,
            value: soldDetails,
            inline: false
        });
    }

    await interaction.reply({ embeds: [successEmbed] });
}

async function handleCommandError(interaction, error) {
    console.error("Sell command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi thực hiện lệnh sell. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}