const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");

const questEmoji = "📋"; // Quest emoji
const zigoldEmoji = "🪙"; // ZiGold emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const checkEmoji = "✅"; // Check emoji
const giftEmoji = "🎁"; // Gift emoji
const fireEmoji = "🔥"; // Fire emoji

module.exports.data = {
    name: "claim_quest",
    type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
    try {
        const ZiRank = useFunctions().get("ZiRank");
        const DataBase = useDB();

        // Check if database and functions are properly initialized
        if (!DataBase || !DataBase.ZiUser || !ZiRank) {
            return await handleInitializationError(interaction, !DataBase);
        }

        // Extract data from custom ID and verify ownership
        const customIdParts = interaction.customId.split(':');
        const userId = customIdParts[1];
        const questId = customIdParts[2];
        
        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Unauthorized")
                .setColor("#FF4757")
                .setDescription("Bạn không thể nhận phần thưởng quest của người khác!");
            return await interaction.update({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }

        // Get user data
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        if (!userDB || !userDB.dailyQuests) {
            return await showQuestNotFoundError(interaction);
        }

        // Find the specific quest in both daily and weekly quests
        const dailyQuest = userDB.dailyQuests?.find(q => q.id === questId);
        const weeklyQuest = userDB.weeklyQuests?.find(q => q.id === questId);
        const quest = dailyQuest || weeklyQuest;
        const isWeeklyQuest = !!weeklyQuest;
        
        if (!quest) {
            return await showQuestNotFoundError(interaction);
        }

        if (!quest.completed) {
            return await showQuestNotCompletedError(interaction);
        }

        if (quest.claimed) {
            return await showQuestAlreadyClaimedError(interaction);
        }

        // Process quest claim atomically (including XP)
        const result = await claimQuestReward(DataBase, userId, questId, quest.reward, isWeeklyQuest, ZiRank, interaction.user);
        if (!result.success) {
            return await showClaimError(interaction, result.error);
        }

        // Show success message
        await showClaimSuccess(interaction, quest);

    } catch (error) {
        console.error("Error in claim_quest:", error);
        await handleButtonError(interaction, error);
    }
};

async function claimQuestReward(DataBase, userId, questId, reward, isWeeklyQuest = false, ZiRank = null, user = null) {
    try {
        // Determine which quest array to update
        const questField = isWeeklyQuest ? "weeklyQuests" : "dailyQuests";
        
        // Update the quest as claimed and add rewards atomically
        const result = await DataBase.ZiUser.findOneAndUpdate(
            { 
                userID: userId,
                [`${questField}.id`]: questId,
                [`${questField}.completed`]: true,
                [`${questField}.claimed`]: false
            },
            {
                $set: { [`${questField}.$.claimed`]: true },
                $inc: { coin: reward.zigold }
            },
            { new: true }
        );

        if (!result) {
            return { success: false, error: "Quest không thể nhận hoặc đã được nhận rồi!" };
        }

        // Give XP reward atomically as part of the same operation
        if (ZiRank && user) {
            try {
                await ZiRank.execute({
                    user: user,
                    XpADD: reward.xp,
                    CoinADD: 0
                });
            } catch (xpError) {
                console.error("Error awarding XP:", xpError);
                // XP error shouldn't fail the entire claim since coins were already awarded
            }
        }

        return { success: true, newBalance: result.coin };
    } catch (error) {
        console.error("Error claiming quest reward:", error);
        return { success: false, error: "Lỗi khi nhận phần thưởng quest!" };
    }
}

async function showClaimSuccess(interaction, quest) {
    const questTypes = {
        hunt: { name: "Hunt Animals", emoji: "🏹" },
        feed: { name: "Feed Pets", emoji: "🍖" },
        play: { name: "Pet Playtime", emoji: "🎾" },
        gamble: { name: "Lucky Player", emoji: "🎰" },
        battle: { name: "Battle Warrior", emoji: "⚔️" }
    };

    // Handle both daily and weekly quests
    let questConfig;
    if (quest.questType === 'weekly') {
        questConfig = { name: quest.name, emoji: quest.emoji || "🏆" };
    } else {
        questConfig = questTypes[quest.type] || { name: "Unknown Quest", emoji: "❓" };
    }

    const questTypeLabel = quest.questType === 'weekly' ? '🔥 Weekly Quest' : '📅 Daily Quest';
    let description = `${sparkleEmoji} **${questTypeLabel} hoàn thành thành công!**\n\n`;
    description += `${questConfig.emoji} **${questConfig.name}**\n`;
    description += `✅ ${quest.description}\n\n`;
    description += `🎁 **Phần thưởng đã nhận:**\n`;
    description += `💰 ${quest.reward.zigold.toLocaleString()} ZiGold\n`;
    description += `⭐ ${quest.reward.xp} XP\n\n`;
    description += `${fireEmoji} **Chúc mừng! Hãy tiếp tục hoàn thành các quest khác!**`;

    const embed = new EmbedBuilder()
        .setTitle(`${giftEmoji} Quest Reward Claimed`)
        .setColor("#00FF00")
        .setDescription(description)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `Quest hoàn thành! Kiểm tra /quests để xem quest khác`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function showQuestNotFoundError(interaction) {
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Quest không tìm thấy")
        .setColor("#FF4757")
        .setDescription("Quest này không tồn tại hoặc đã hết hạn!");
    await interaction.update({ embeds: [errorEmbed], components: [] });
}

async function showQuestNotCompletedError(interaction) {
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Quest chưa hoàn thành")
        .setColor("#FF4757")
        .setDescription("Bạn cần hoàn thành quest này trước khi nhận phần thưởng!");
    await interaction.update({ embeds: [errorEmbed], components: [] });
}

async function showQuestAlreadyClaimedError(interaction) {
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Đã nhận rồi")
        .setColor("#FF4757")
        .setDescription("Bạn đã nhận phần thưởng quest này rồi!");
    await interaction.update({ embeds: [errorEmbed], components: [] });
}

async function showClaimError(interaction, errorMessage) {
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi nhận thưởng")
        .setColor("#FF4757")
        .setDescription(`**Lỗi:** ${errorMessage}\n\n🔄 Vui lòng thử lại!`);
    await interaction.update({ embeds: [errorEmbed], components: [] });
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
        return await interaction.update({ embeds: [errorEmbed], components: [] });
    }
}

async function handleButtonError(interaction, error) {
    console.error("Claim quest button error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi nhận phần thưởng quest. Vui lòng thử lại!");
    
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