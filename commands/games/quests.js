const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");

const questEmoji = "📋"; // Biểu tượng nhiệm vụ
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const checkEmoji = "✅"; // Biểu tượng đánh dấu
const clockEmoji = "⏰"; // Biểu tượng đồng hồ
const targetEmoji = "🎯"; // Biểu tượng mục tiêu
const giftEmoji = "🎁"; // Biểu tượng quà tặng
const fireEmoji = "🔥"; // Biểu tượng lửa

// Các loại nhiệm vụ và cấu hình của chúng
const questTypes = {
    hunt: {
        name: "Hunt Animals",
        description: "Hunt {target} animals",
        emoji: "🏹",
        baseTarget: 10,
        baseReward: { zigold: 500, xp: 25 },
        difficulty: {
            easy: { multiplier: 1, label: "Easy" },
            medium: { multiplier: 2, label: "Medium" },
            hard: { multiplier: 3, label: "Hard" }
        }
    },
    feed: {
        name: "Feed Pets",
        description: "Feed your pets {target} times",
        emoji: "🍖",
        baseTarget: 5,
        baseReward: { zigold: 300, xp: 15 },
        difficulty: {
            easy: { multiplier: 1, label: "Easy" },
            medium: { multiplier: 2, label: "Medium" },
            hard: { multiplier: 3, label: "Hard" }
        }
    },
    play: {
        name: "Pet Playtime",
        description: "Play with pets {target} times",
        emoji: "🎾",
        baseTarget: 5,
        baseReward: { zigold: 300, xp: 15 },
        difficulty: {
            easy: { multiplier: 1, label: "Easy" },
            medium: { multiplier: 2, label: "Medium" },
            hard: { multiplier: 3, label: "Hard" }
        }
    },
    gamble: {
        name: "Lucky Player",
        description: "Win {target} gambling games",
        emoji: "🎰",
        baseTarget: 3,
        baseReward: { zigold: 800, xp: 35 },
        difficulty: {
            easy: { multiplier: 1, label: "Easy" },
            medium: { multiplier: 2, label: "Medium" },
            hard: { multiplier: 3, label: "Hard" }
        }
    },
    battle: {
        name: "Battle Warrior",
        description: "Win {target} battles",
        emoji: "⚔️",
        baseTarget: 2,
        baseReward: { zigold: 600, xp: 30 },
        difficulty: {
            easy: { multiplier: 1, label: "Easy" },
            medium: { multiplier: 2, label: "Medium" },
            hard: { multiplier: 4, label: "Hard" }
        }
    }
};

module.exports.data = {
    name: "quests",
    description: "Xem và nhận quest hàng ngày để kiếm thêm phần thưởng!",
    type: 1,
    options: [],
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

        // Get or create user quest data
        let userDB = await DataBase.ZiUser.findOne({ userID: userId });
        if (!userDB) {
            return await showUserNotFoundError(interaction);
        }

        // Initialize or reset quests if needed
        const today = new Date().toDateString();
        const thisWeek = getWeekString(new Date());
        const lastQuestDate = userDB.lastQuestReset ? new Date(userDB.lastQuestReset).toDateString() : null;
        const lastWeeklyDate = userDB.lastWeeklyReset ? getWeekString(new Date(userDB.lastWeeklyReset)) : null;

        // Reset daily quests if needed
        if (lastQuestDate !== today || !userDB.dailyQuests) {
            userDB = await resetDailyQuests(DataBase, userId, today);
        }
        
        // Reset weekly quests if needed
        if (lastWeeklyDate !== thisWeek || !userDB.weeklyQuests) {
            userDB = await resetWeeklyQuests(DataBase, userId, thisWeek, userDB);
        }

        // Refresh user data to get both daily and weekly quests
        const finalUserDB = await DataBase.ZiUser.findOne({ userID: userId });
        
        // Show quest menu
        await showQuestMenu(interaction, finalUserDB, userName);

    } catch (error) {
        console.error("Error in quests command:", error);
        await handleCommandError(interaction, error);
    }
};

async function resetDailyQuests(DataBase, userId, today) {
    // Generate 3 random daily quests with varying difficulties
    const availableTypes = Object.keys(questTypes);
    const selectedTypes = [];
    
    // Pick 3 different quest types
    while (selectedTypes.length < 3) {
        const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        if (!selectedTypes.includes(randomType)) {
            selectedTypes.push(randomType);
        }
    }

    const difficulties = ['easy', 'medium', 'hard'];
    const newQuests = selectedTypes.map((type, index) => {
        const difficulty = difficulties[index];
        const questConfig = questTypes[type];
        const difficultyConfig = questConfig.difficulty[difficulty];
        
        const target = Math.ceil(questConfig.baseTarget * difficultyConfig.multiplier);
        const reward = {
            zigold: Math.ceil(questConfig.baseReward.zigold * difficultyConfig.multiplier),
            xp: Math.ceil(questConfig.baseReward.xp * difficultyConfig.multiplier)
        };

        return {
            id: `${type}_${difficulty}_${Date.now()}`,
            type: type,
            difficulty: difficulty,
            target: target,
            progress: 0,
            reward: reward,
            completed: false,
            claimed: false,
            description: questConfig.description.replace('{target}', target)
        };
    });

    // Update user with new quests
    const updatedUser = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId },
        {
            $set: {
                dailyQuests: newQuests,
                lastQuestReset: new Date(today)
            }
        },
        { new: true, upsert: true }
    );

    return updatedUser;
}

// Helper function to get week string (YYYY-WW format)
function getWeekString(date) {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-${weekNumber.toString().padStart(2, '0')}`;
}

async function resetWeeklyQuests(DataBase, userId, thisWeek, userDB = null) {
    // Weekly quest types with larger targets and better rewards
    const weeklyQuestTypes = {
        hunt_master: {
            name: "Hunt Master",
            description: "Hunt {target} animals this week",
            emoji: "🏹",
            type: "hunt",
            target: 50,
            reward: { zigold: 5000, xp: 200 }
        },
        pet_caretaker: {
            name: "Pet Caretaker",
            description: "Feed pets {target} times this week",
            emoji: "🍖",
            type: "feed",
            target: 25,
            reward: { zigold: 3000, xp: 120 }
        },
        gambling_champion: {
            name: "Gambling Champion",
            description: "Win {target} gambling games this week",
            emoji: "🎰",
            type: "gamble",
            target: 15,
            reward: { zigold: 8000, xp: 300 }
        },
        battle_legend: {
            name: "Battle Legend",
            description: "Win {target} battles this week",
            emoji: "⚔️",
            type: "battle",
            target: 8,
            reward: { zigold: 10000, xp: 400 }
        }
    };

    // Generate 2 random weekly quests
    const availableTypes = Object.keys(weeklyQuestTypes);
    const selectedTypes = [];
    
    while (selectedTypes.length < 2) {
        const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        if (!selectedTypes.includes(randomType)) {
            selectedTypes.push(randomType);
        }
    }

    const newWeeklyQuests = selectedTypes.map(questKey => {
        const questConfig = weeklyQuestTypes[questKey];
        
        return {
            id: `${questKey}_weekly_${Date.now()}`,
            type: questConfig.type,
            questType: 'weekly',
            name: questConfig.name,
            target: questConfig.target,
            progress: 0,
            reward: questConfig.reward,
            completed: false,
            claimed: false,
            description: questConfig.description.replace('{target}', questConfig.target),
            emoji: questConfig.emoji
        };
    });

    // Update user with new weekly quests
    const updatedUser = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId },
        {
            $set: {
                weeklyQuests: newWeeklyQuests,
                lastWeeklyReset: new Date()
            }
        },
        { new: true, upsert: true }
    );

    return updatedUser;
}

async function showQuestMenu(interaction, userDB, userName) {
    const dailyQuests = userDB.dailyQuests || [];
    const weeklyQuests = userDB.weeklyQuests || [];
    const dailyCompletedCount = dailyQuests.filter(q => q.completed).length;
    const dailyClaimedCount = dailyQuests.filter(q => q.claimed).length;
    const weeklyCompletedCount = weeklyQuests.filter(q => q.completed).length;
    const weeklyClaimedCount = weeklyQuests.filter(q => q.claimed).length;

    let description = `${sparkleEmoji} **Quest System của ${userName}**\n\n`;
    description += `📅 **Daily:** ${dailyCompletedCount}/3 hoàn thành • ${dailyClaimedCount}/3 đã nhận\n`;
    description += `📆 **Weekly:** ${weeklyCompletedCount}/2 hoàn thành • ${weeklyClaimedCount}/2 đã nhận\n\n`;

    // Show Daily Quests
    description += `📅 **═══ DAILY QUESTS ═══**\n`;
    if (dailyQuests.length === 0) {
        description += `${clockEmoji} **Chưa có quest nào!**\n\n`;
    } else {
        dailyQuests.forEach((quest, index) => {
            const questConfig = questTypes[quest.type];
            const difficultyConfig = questConfig.difficulty[quest.difficulty];
            const progressBar = createProgressBar(quest.progress, quest.target);
            
            let status = quest.claimed ? checkEmoji : quest.completed ? giftEmoji : targetEmoji;
            
            description += `${status} **${questConfig.name}** (${difficultyConfig.label})\n`;
            description += `${questConfig.emoji} ${quest.description}\n`;
            description += `📈 ${progressBar} ${quest.progress}/${quest.target}\n`;
            description += `🎁 **Phần thưởng:** ${quest.reward.zigold.toLocaleString()} ${zigoldEmoji} + ${quest.reward.xp} XP\n`;
            
            if (quest.claimed) {
                description += `✅ **Đã nhận phần thưởng**\n\n`;
            } else if (quest.completed) {
                description += `🎉 **Hoàn thành! Nhấn Claim để nhận thưởng**\n\n`;
            } else {
                description += `⏳ **Đang thực hiện...**\n\n`;
            }
        });
    }
    
    // Show Weekly Quests
    description += `📆 **═══ WEEKLY QUESTS ═══**\n`;
    if (weeklyQuests.length === 0) {
        description += `${clockEmoji} **Chưa có quest nào!**\n\n`;
    } else {
        weeklyQuests.forEach((quest, index) => {
            const progressBar = createProgressBar(quest.progress, quest.target);
            
            let status = quest.claimed ? checkEmoji : quest.completed ? giftEmoji : targetEmoji;
            
            description += `${status} **${quest.name}** ${fireEmoji}\n`;
            description += `${quest.emoji} ${quest.description}\n`;
            description += `📈 ${progressBar} ${quest.progress}/${quest.target}\n`;
            description += `🎁 **Phần thưởng:** ${quest.reward.zigold.toLocaleString()} ${zigoldEmoji} + ${quest.reward.xp} XP\n`;
            
            if (quest.claimed) {
                description += `✅ **Đã nhận phần thưởng**\n\n`;
            } else if (quest.completed) {
                description += `🎉 **Hoàn thành! Nhấn Claim để nhận thưởng**\n\n`;
            } else {
                description += `⏳ **Đang thực hiện...**\n\n`;
            }
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(`${questEmoji} Quest System ${sparkleEmoji}`)
        .setColor("#4ECDC4")
        .setDescription(description)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: "Daily reset 00:00 • Weekly reset Monday 00:00 • Hoàn thành để nhận phần thưởng!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    // Add claim buttons for completed quests (both daily and weekly)
    const claimableDailyQuests = dailyQuests.filter(q => q.completed && !q.claimed);
    const claimableWeeklyQuests = weeklyQuests.filter(q => q.completed && !q.claimed);
    const allClaimableQuests = [...claimableDailyQuests, ...claimableWeeklyQuests];
    
    if (allClaimableQuests.length > 0) {
        const components = [];
        
        // First row for daily quests
        if (claimableDailyQuests.length > 0) {
            const dailyRow = new ActionRowBuilder();
            claimableDailyQuests.slice(0, 5).forEach(quest => { // Max 5 buttons per row
                const questConfig = questTypes[quest.type];
                const label = quest.questType === 'weekly' ? `Weekly: ${quest.name}` : `Daily: ${questConfig.name}`;
                dailyRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`claim_quest:${interaction.user.id}:${quest.id}`)
                        .setLabel(label.slice(0, 80)) // Discord button label limit
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(giftEmoji)
                );
            });
            components.push(dailyRow);
        }
        
        // Second row for weekly quests
        if (claimableWeeklyQuests.length > 0 && components.length < 5) {
            const weeklyRow = new ActionRowBuilder();
            claimableWeeklyQuests.slice(0, 5).forEach(quest => { // Max 5 buttons per row
                const label = `Weekly: ${quest.name}`;
                weeklyRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`claim_quest:${interaction.user.id}:${quest.id}`)
                        .setLabel(label.slice(0, 80)) // Discord button label limit
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(fireEmoji)
                );
            });
            components.push(weeklyRow);
        }
        
        await interaction.reply({ embeds: [embed], components: components });
    } else {
        await interaction.reply({ embeds: [embed] });
    }
}

function createProgressBar(current, max) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.floor(percentage * 10);
    const empty = 10 - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Helper function to update quest progress (called from other commands)
async function updateQuestProgress(DataBase, userId, questType, amount = 1) {
    try {
        const user = await DataBase.ZiUser.findOne({ userID: userId });
        if (!user) return;

        const today = new Date().toDateString();
        const thisWeek = getWeekString(new Date());
        const lastQuestDate = user.lastQuestReset ? new Date(user.lastQuestReset).toDateString() : null;
        const lastWeeklyDate = user.lastWeeklyReset ? getWeekString(new Date(user.lastWeeklyReset)) : null;
        
        let updateFields = {};
        
        // Update daily quests
        if (user.dailyQuests && lastQuestDate === today) {
            let dailyHasUpdates = false;
            const updatedDailyQuests = user.dailyQuests.map(quest => {
                if (quest.type === questType && !quest.completed) {
                    quest.progress = Math.min(quest.progress + amount, quest.target);
                    if (quest.progress >= quest.target) {
                        quest.completed = true;
                    }
                    dailyHasUpdates = true;
                }
                return quest;
            });
            
            if (dailyHasUpdates) {
                updateFields.dailyQuests = updatedDailyQuests;
            }
        }
        
        // Update weekly quests
        if (user.weeklyQuests && lastWeeklyDate === thisWeek) {
            let weeklyHasUpdates = false;
            const updatedWeeklyQuests = user.weeklyQuests.map(quest => {
                if (quest.type === questType && !quest.completed) {
                    quest.progress = Math.min(quest.progress + amount, quest.target);
                    if (quest.progress >= quest.target) {
                        quest.completed = true;
                    }
                    weeklyHasUpdates = true;
                }
                return quest;
            });
            
            if (weeklyHasUpdates) {
                updateFields.weeklyQuests = updatedWeeklyQuests;
            }
        }
        
        // Apply updates if any
        if (Object.keys(updateFields).length > 0) {
            await DataBase.ZiUser.updateOne(
                { userID: userId },
                { $set: updateFields }
            );
        }
    } catch (error) {
        console.error("Error updating quest progress:", error);
    }
}

async function showUserNotFoundError(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("❌ Người dùng không tìm thấy")
        .setColor("#FF4757")
        .setDescription("Không tìm thấy dữ liệu của bạn trong hệ thống. Hãy sử dụng một số lệnh khác trước!");
    await interaction.reply({ embeds: [embed], ephemeral: true });
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
    console.error("Quests command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi xem quest. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// Export the helper function for use in other commands
module.exports.updateQuestProgress = updateQuestProgress;