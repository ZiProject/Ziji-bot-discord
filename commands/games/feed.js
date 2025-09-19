const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");
const { updateQuestProgress } = require("./quests.js");

const FEED_COOLDOWN = 8 * 60 * 60 * 1000; // 8 hours
const FEED_COST = 25; // Zigold cost to feed pets
const HAPPINESS_GAIN = 20; // Happiness gained from feeding
const XP_REWARD = 15; // XP reward for feeding

const feedEmoji = "🍖"; // Feed emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const happinessEmoji = "💖"; // Happiness emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const petEmoji = "🐾"; // Pet emoji
const clockEmoji = "⏰"; // Clock emoji

// Food types with different effects
const FOOD_TYPES = {
    basic: { 
        name: "Thức ăn cơ bản", 
        emoji: "🥓", 
        cost: 25, 
        happiness: 20, 
        xp: 15,
        description: "Thức ăn đơn giản nhưng dinh dưỡng"
    },
    premium: { 
        name: "Thức ăn cao cấp", 
        emoji: "🥩", 
        cost: 75, 
        happiness: 35, 
        xp: 30,
        description: "Thức ăn chất lượng cao với nhiều dinh dưỡng"
    },
    deluxe: { 
        name: "Thức ăn siêu cao cấp", 
        emoji: "🦴", 
        cost: 150, 
        happiness: 50, 
        xp: 50,
        description: "Thức ăn tốt nhất dành cho thú cưng của bạn"
    }
};

module.exports.data = {
    name: "feed",
    description: "Cho thú cưng ăn để tăng happiness và nhận XP!",
    type: 1,
    options: [
        {
            type: 3,
            name: "food_type",
            description: "Loại thức ăn",
            required: false,
            choices: [
                { name: "🥓 Thức ăn cơ bản (25 ZiGold)", value: "basic" },
                { name: "🥩 Thức ăn cao cấp (75 ZiGold)", value: "premium" },
                { name: "🦴 Thức ăn siêu cao cấp (150 ZiGold)", value: "deluxe" }
            ]
        }
    ],
    integration_types: [0, 1], // Guild app + User app  
    contexts: [0, 1, 2], // Guild + DM + Private channels
    dm_permission: true,
    nsfw: false,
};

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
        const foodType = interaction.options?.getString("food_type") || "basic";
        const currentTime = new Date();

        // Get user data
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        if (!userDB) {
            return await showNoAnimalsError(interaction);
        }

        // Check if user has any animals
        if (!userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
            return await showNoAnimalsError(interaction);
        }

        // Check cooldown
        const lastFeed = userDB.petCare?.lastFeed ? new Date(userDB.petCare.lastFeed) : null;
        if (lastFeed) {
            const timeSinceLastFeed = currentTime - lastFeed;
            if (timeSinceLastFeed < FEED_COOLDOWN) {
                const hoursLeft = Math.ceil((FEED_COOLDOWN - timeSinceLastFeed) / (1000 * 60 * 60));
                return await showFeedCooldown(interaction, hoursLeft);
            }
        }

        const food = FOOD_TYPES[foodType];
        
        // Check if user has enough Zigold
        if (userDB.coin < food.cost) {
            return await showInsufficientFunds(interaction, food.cost, userDB.coin);
        }

        // Calculate current happiness (decreases over time)
        const currentHappiness = calculateCurrentHappiness(userDB.petCare);
        
        // Calculate new happiness (max 100)
        const newHappiness = Math.min(100, currentHappiness + food.happiness);
        
        // Get random animal from collection for feeding animation
        const randomAnimal = getRandomOwnedAnimal(userDB.huntStats);
        
        // Update database
        await DataBase.ZiUser.updateOne(
            { userID: userId },
            {
                $set: {
                    "petCare.lastFeed": currentTime,
                    "petCare.happiness": newHappiness
                },
                $inc: {
                    "petCare.totalFeedings": 1,
                    coin: -food.cost
                }
            }
        );

        // Update quest progress for feeding
        await updateQuestProgress(DataBase, userId, 'feed', 1);

        // Give XP
        await ZiRank.execute({
            user: interaction.user,
            XpADD: food.xp,
            CoinADD: 0
        });

        // Show success message
        await showFeedSuccess(interaction, food, randomAnimal, currentHappiness, newHappiness, userName);

    } catch (error) {
        console.error("Error in feed command:", error);
        await handleCommandError(interaction, error);
    }
};

function calculateCurrentHappiness(petCare) {
    if (!petCare || (!petCare.lastFeed && !petCare.lastPlay)) {
        return petCare?.happiness || 100;
    }

    const lastActivity = Math.max(
        petCare.lastFeed ? new Date(petCare.lastFeed).getTime() : 0,
        petCare.lastPlay ? new Date(petCare.lastPlay).getTime() : 0
    );
    
    const currentTime = new Date();
    const hoursSinceLastActivity = (currentTime - lastActivity) / (1000 * 60 * 60);

    // Happiness decreases by 2 per hour, minimum 0
    const happinessDecay = Math.floor(hoursSinceLastActivity * 2);
    const currentHappiness = Math.max(0, (petCare.happiness || 100) - happinessDecay);

    return currentHappiness;
}

function getRandomOwnedAnimal(huntStats) {
    const allAnimals = [];
    
    // Collect all owned animals
    for (const [rarity, animalData] of Object.entries(huntStats)) {
        if (animals[rarity]) {
            for (const [animalName, data] of Object.entries(animalData)) {
                if (data && data.count > 0) {
                    const animalInfo = animals[rarity].find(a => a.name === animalName);
                    if (animalInfo) {
                        allAnimals.push({
                            ...animalInfo,
                            rarity: rarity,
                            count: data.count
                        });
                    }
                }
            }
        }
    }

    if (allAnimals.length === 0) {
        return { name: "thú cưng", emoji: "🐾", rarity: "common" };
    }

    // Pick random animal
    return allAnimals[Math.floor(Math.random() * allAnimals.length)];
}

async function showNoAnimalsError(interaction) {
    const embed = new EmbedBuilder()
        .setTitle(`${petEmoji} Không có thú cưng`)
        .setColor("#FF6B6B")
        .setDescription(`🔍 **Bạn chưa có thú cưng nào để chăm sóc!**\n\n🏹 Hãy dùng lệnh \`\`\`text\n/hunt\n\`\`\` để bắt thú cưng đầu tiên của bạn!\n\n${sparkleEmoji} Sau khi có thú cưng, bạn có thể cho chúng ăn để tăng happiness và nhận XP!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: "Sử dụng /hunt để bắt đầu collection của bạn!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function showFeedCooldown(interaction, hoursLeft) {
    const embed = new EmbedBuilder()
        .setTitle(`${clockEmoji} Feed Cooldown`)
        .setColor("#FFD700")
        .setDescription(`⏳ **Thú cưng của bạn vẫn đang no!**\n\n${feedEmoji} **Thời gian còn lại:** ${hoursLeft} giờ\n\n💡 Thú cưng cần thời gian để tiêu hóa trước khi ăn tiếp!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `Quay lại sau ${hoursLeft} giờ để feed tiếp!`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function showInsufficientFunds(interaction, cost, currentCoin) {
    const embed = new EmbedBuilder()
        .setTitle(`${zigoldEmoji} Không đủ ZiGold`)
        .setColor("#FF6B6B")
        .setDescription(`💸 **Bạn không đủ ZiGold để mua thức ăn!**\n\n${zigoldEmoji} **Cần:** ${cost} ZiGold\n${zigoldEmoji} **Hiện có:** ${currentCoin} ZiGold\n${zigoldEmoji} **Thiếu:** ${cost - currentCoin} ZiGold\n\n🏹 Hãy đi săn thêm hoặc bán animals để kiếm ZiGold!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: "Sử dụng /hunt hoặc /sell để kiếm ZiGold!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function showFeedSuccess(interaction, food, animal, oldHappiness, newHappiness, userName) {
    const happinessGain = newHappiness - oldHappiness;
    const happinessBar = getHappinessBar(newHappiness);
    
    // Create feeding messages
    const feedingMessages = [
        `${animal.emoji} **${animal.name}** đang thưởng thức ${food.emoji} **${food.name}**!`,
        `${animal.emoji} **${animal.name}** rất hài lòng với ${food.emoji} **${food.name}**!`,
        `${animal.emoji} **${animal.name}** ăn ${food.emoji} **${food.name}** với vẻ thích thú!`,
        `${animal.emoji} **${animal.name}** cảm ơn bạn vì ${food.emoji} **${food.name}** ngon!`
    ];
    
    const randomMessage = feedingMessages[Math.floor(Math.random() * feedingMessages.length)];

    let description = `${sparkleEmoji} **Pet feeding thành công!**\n\n`;
    description += `${randomMessage}\n\n`;
    description += `${zigoldEmoji} **-${food.cost} ZiGold**\n`;
    description += `${happinessEmoji} **+${happinessGain} Happiness** (${oldHappiness} → ${newHappiness})\n`;
    description += `✨ **+${food.xp} XP**\n\n`;
    description += `${happinessEmoji} **Happiness:** ${happinessBar} ${newHappiness}/100\n`;
    
    // Add bonus message for high happiness
    if (newHappiness >= 80) {
        description += `\n🌟 **Thú cưng của bạn rất hạnh phúc!**`;
    } else if (newHappiness <= 30) {
        description += `\n😢 **Thú cưng cần được chăm sóc thêm!**`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`${feedEmoji} Pet Feeding - ${userName}`)
        .setColor(newHappiness >= 80 ? "#00FF00" : newHappiness >= 50 ? "#FFD700" : "#FF6B6B")
        .setDescription(description)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `${food.description} • Quay lại sau 8 giờ để feed tiếp!`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

function getHappinessBar(happiness) {
    const bars = Math.floor(happiness / 10);
    const fullBars = "💖".repeat(bars);
    const emptyBars = "💔".repeat(10 - bars);
    return fullBars + emptyBars;
}

async function handleInitializationError(interaction, isDatabaseError) {
    const errorEmbed = new EmbedBuilder()
        .setTitle(`⚠️ ${sparkleEmoji} Khởi tạo hệ thống`)
        .setColor("#FFD700")
        .setDescription(
            isDatabaseError 
                ? "🔄 **Đang khởi tạo database...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!"
                : "🔄 **Đang khởi tạo functions...**\n\n⏳ Vui lòng đợi trong giây lát và thử lại!"
        )
        .setThumbnail(interaction.client.user.displayAvatarURL({ size: 1024 }))
        .setFooter({ 
            text: "Hệ thống đang được khởi tạo, vui lòng thử lại sau ít phút!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleCommandError(interaction, error) {
    console.error("Feed command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi feed thú cưng. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}