const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB, useConfig } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");
const { updateQuestProgress } = require("./quests.js");

const HUNT_COOLDOWN = 20 * 1000; // 20 giây
const BASE_HUNT_COST = animals.hunt_costs.base;
const LOOTBOX_CHANCE = animals.lootbox.chance;

const huntEmoji = "🏹"; // Biểu tượng săn bắn
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold  
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const gemEmoji = "💎"; // Biểu tượng đá quý
const crownEmoji = "👑"; // Biểu tượng vương miện
const starEmoji = "⭐"; // Biểu tượng ngôi sao
const rocketEmoji = "🚀"; // Biểu tượng tên lửa


module.exports.data = {
        name: "hunt",
        description: "Đi săn bắt thú để thu thập vào collection của bạn!",
        type: 1,
        options: [],
        integration_types: [0, 1], // Ứng dụng máy chủ + Ứng dụng người dùng  
        contexts: [0, 1, 2], // Máy chủ + Tin nhắn riêng + Kênh riêng tư
        dm_permission: true,
        nsfw: false,
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const ZiRank = useFunctions().get("ZiRank");
                const DataBase = useDB();
                const config = useConfig();

                // Kiểm tra xem cơ sở dữ liệu và các hàm được khởi tạo đúng cách
                if (!DataBase || !DataBase.ZiUser || !ZiRank) {
                        return await handleInitializationError(interaction, !DataBase);
                }

                const userId = interaction.user.id;
                const guildId = interaction.guild?.id;
                const now = new Date();

                // Lấy dữ liệu người dùng với tích hợp ZiRank
                let userLang;
                try {
                        userLang = await ZiRank.execute({ user: interaction.user, XpADD: 0, CoinADD: 0 });
                } catch (error) {
                        console.error('Hunt command - ZiRank error:', error.message);
                        userLang = lang;
                }

                const userDB = await DataBase.ZiUser.findOne({ userID: userId });


                // Tính toán chi phí săn bắn với giảm giá theo cấp độ
                const huntCost = calculateHuntCost(userDB);
                
                // Kiểm tra xem người dùng có đủ Zigold không
                if (!userDB || (userDB.coin || 0) < huntCost) {
                        return await showInsufficientFunds(interaction, huntCost, userDB?.coin || 0);
                }

                // Săn bắn động vật
                const huntResult = generateHuntResult(userDB);
                
                // Tính toán phần thưởng XP
                const xpReward = calculateXPReward(huntResult, userDB);
                
                // Kiểm tra lootbox
                const lootboxResult = checkLootbox(userDB, huntResult);
                
                // Tính toán ngưỡng thời gian chờ cho việc thực thi nguyên tử
                const cooldownThreshold = new Date(now.getTime() - HUNT_COOLDOWN);
                
                // Update user data with atomic cooldown and coin checks
                const updateResult = await updateUserHunt(DataBase, userId, now, huntResult, huntCost, lootboxResult, cooldownThreshold);
                
                if (!updateResult.success) {
                        // Handle different error types
                        if (updateResult.error === "INVALID_CONDITIONS" || updateResult.error === "RACE_CONDITION") {
                                // This could be cooldown active, insufficient funds, or race condition
                                // Calculate remaining cooldown time to provide helpful message
                                const timeSinceLastHunt = userDB?.lastHunt ? now.getTime() - new Date(userDB.lastHunt).getTime() : HUNT_COOLDOWN;
                                const isOnCooldown = timeSinceLastHunt < HUNT_COOLDOWN;
                                
                                if (isOnCooldown) {
                                        const timeLeft = HUNT_COOLDOWN - timeSinceLastHunt;
                                        const secondsLeft = Math.ceil(timeLeft / 1000);
                                        const cooldownCheck = {
                                                onCooldown: true,
                                                timeLeft: { seconds: secondsLeft },
                                                totalTimeLeft: timeLeft
                                        };
                                        return await showCooldownMessage(interaction, cooldownCheck, userDB);
                                } else {
                                        // Likely insufficient funds or race condition
                                        return await showInsufficientFunds(interaction, huntCost, userDB?.coin || 0);
                                }
                        } else {
                                // Generic database error
                                return await showHuntError(interaction);
                        }
                }


                // Calculate total XP reward including lootbox bonus
                let totalXpReward = xpReward;
                if (lootboxResult && lootboxResult.found) {
                        totalXpReward += lootboxResult.xpReward;
                }
                
                // Call ZiRank with total XP (including lootbox bonus)
                const updatedLang = await ZiRank.execute({ 
                        user: interaction.user, 
                        XpADD: totalXpReward,
                        CoinADD: 0 // We handle coins in updateUserHunt
                });
                
                // Get final user data after all updates
                const finalUserData = await DataBase.ZiUser.findOne({ userID: userId });
                
                // Check for level up
                const levelUpInfo = checkLevelUp(userDB, finalUserData);

                // Send success message
                await sendHuntSuccessMessage(
                        interaction, 
                        huntResult, 
                        totalXpReward,
                        huntCost,
                        finalUserData, 
                        levelUpInfo,
                        lootboxResult,
                        updatedLang || userLang
                );

        } catch (error) {
                logHuntDebug('COMMAND_FATAL_ERROR', {
                        userID: interaction.user.id,
                        guildID: interaction.guild?.id,
                        userTag: interaction.user.tag
                }, error);
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

function checkHuntCooldown(userDB, now) {
        if (!userDB?.lastHunt) {
                return { onCooldown: false };
        }

        const lastHunt = new Date(userDB.lastHunt);
        const timeDiff = now.getTime() - lastHunt.getTime();
        
        if (timeDiff < HUNT_COOLDOWN) {
                const timeLeft = HUNT_COOLDOWN - timeDiff;
                const secondsLeft = Math.ceil(timeLeft / 1000);
                
                return {
                        onCooldown: true,
                        timeLeft: { seconds: secondsLeft },
                        totalTimeLeft: timeLeft
                };
        }
        
        return { onCooldown: false };
}

async function showCooldownMessage(interaction, cooldownCheck, userDB) {
        const { seconds } = cooldownCheck.timeLeft;
        
        const cooldownEmbed = new EmbedBuilder()
                .setTitle(`⏰ ${huntEmoji} Hunt Cooldown ${sparkleEmoji}`)
                .setColor("#FF6B9D")
                .setDescription(`**${sparkleEmoji} Bạn đã hunt gần đây!**\n\n🎯 Hãy đợi một chút để tiếp tục hunt ${gemEmoji}`)
                .addFields({
                        name: `⏳ ${sparkleEmoji} Thời gian còn lại`,
                        value: `\`\`\`${seconds} giây\`\`\``,
                        inline: true
                })
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                        text: `${huntEmoji} Hãy chuẩn bị sẵn sàng cho cuộc hunt tiếp theo! • ZiBot Hunt System`,
                        iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

        return await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
}

function calculateHuntCost(userDB) {
        const userLevel = userDB?.level || 1;
        let cost = BASE_HUNT_COST;
        
        // Apply level discounts
        if (userLevel >= 100) cost *= animals.hunt_costs.discounts.level_100;
        else if (userLevel >= 50) cost *= animals.hunt_costs.discounts.level_50;
        else if (userLevel >= 25) cost *= animals.hunt_costs.discounts.level_25;
        else if (userLevel >= 10) cost *= animals.hunt_costs.discounts.level_10;
        
        return Math.floor(cost);
}

async function showInsufficientFunds(interaction, huntCost, userCoin) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Không đủ Zigold!`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Bạn cần **${huntCost.toLocaleString()}** ${zigoldEmoji} Zigold để hunt!\n\n💰 **Số dư hiện tại:** ${userCoin.toLocaleString()} ${zigoldEmoji}\n\n🔄 Hãy claim daily hoặc chơi games khác để kiếm thêm Zigold!`)
                .setFooter({ 
                        text: `${huntEmoji} Sử dụng /daily để nhận Zigold miễn phí!`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

function generateHuntResult(userDB) {
        const userLevel = userDB?.level || 1;
        const rand = Math.random();
        
        // Calculate level bonus (redistributed from common to rare rarities)
        const levelBonus = Math.min(userLevel * 0.001, 0.05); // Max 5% bonus
        
        // Get base probabilities and apply level bonus properly
        const baseProbabilities = animals.rarities;
        const adjustedProbabilities = {};
        
        // Apply level bonus by redistributing probability from common to rare rarities
        const bonusPerRareRarity = levelBonus / 3; // Split between rare, epic, legendary
        
        adjustedProbabilities.common = Math.max(0.05, baseProbabilities.common.chance - levelBonus); // Min 5% for common
        adjustedProbabilities.uncommon = baseProbabilities.uncommon.chance;
        adjustedProbabilities.rare = baseProbabilities.rare.chance + bonusPerRareRarity;
        adjustedProbabilities.epic = baseProbabilities.epic.chance + bonusPerRareRarity;
        adjustedProbabilities.legendary = baseProbabilities.legendary.chance + bonusPerRareRarity;
        
        // Normalize to ensure total = 1.0
        const totalProb = Object.values(adjustedProbabilities).reduce((sum, prob) => sum + prob, 0);
        for (const rarity in adjustedProbabilities) {
                adjustedProbabilities[rarity] = adjustedProbabilities[rarity] / totalProb;
        }
        
        // Find selected rarity using cumulative probability
        let cumulativeChance = 0;
        let selectedRarity = 'common';
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        
        for (const rarity of rarityOrder) {
                cumulativeChance += adjustedProbabilities[rarity];
                if (rand <= cumulativeChance) {
                        selectedRarity = rarity;
                        break;
                }
        }
        
        // Select random animal from rarity
        const rarityAnimals = animals[selectedRarity];
        const selectedAnimal = rarityAnimals[Math.floor(Math.random() * rarityAnimals.length)];
        
        return {
                rarity: selectedRarity,
                animal: selectedAnimal,
                isShiny: Math.random() < 0.02 // 2% chance for shiny
        };
}

function calculateXPReward(huntResult, userDB) {
        let baseXP = huntResult.animal.xp;
        
        // Rarity multiplier
        const rarityMultipliers = {
                'common': 1.0,
                'uncommon': 1.2,
                'rare': 1.5,
                'epic': 2.0,
                'legendary': 3.0
        };
        
        baseXP *= rarityMultipliers[huntResult.rarity];
        
        // Shiny bonus
        if (huntResult.isShiny) {
                baseXP *= 2;
        }
        
        // Level bonus (small)
        const levelBonus = Math.floor((userDB?.level || 1) * 0.5);
        
        return Math.floor(baseXP + levelBonus);
}

async function updateUserHunt(DataBase, userId, now, huntResult, huntCost, lootboxResult, cooldownThreshold) {
        try {
                const animalKey = `${huntResult.rarity}_${huntResult.animal.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                
                // Prepare lootbox rewards if found
                const lootboxRewards = {};
                if (lootboxResult && lootboxResult.found) {
                        lootboxRewards.coin = lootboxResult.zigoldReward;
                        lootboxRewards.lootboxes = 1; // Give 1 lootbox
                }
                
                // Check if user exists first
                let userExists = await DataBase.ZiUser.findOne({ userID: userId });
                
                if (!userExists) {
                        // Create new user first
                        userExists = await DataBase.ZiUser.create({
                                userID: userId,
                                level: 1,
                                xp: 1,
                                volume: 100,
                                color: "Random",
                                coin: 1000,
                                totalAnimals: 0,
                                huntStats: {}
                        });
                }
                
                // Now update existing user with conditions
                const basicUpdateResult = await DataBase.ZiUser.findOneAndUpdate(
                        { 
                                userID: userId,
                                coin: { $gte: huntCost },
                                $or: [
                                        { lastHunt: { $lt: cooldownThreshold } },
                                        { lastHunt: { $exists: false } }
                                ]
                        },
                        {
                                $inc: { 
                                        coin: -huntCost + (lootboxRewards.coin || 0),
                                        totalAnimals: 1,
                                        lootboxes: lootboxRewards.lootboxes || 0
                                },
                                $set: {
                                        lastHunt: now
                                }
                        },
                        { 
                                new: true
                        }
                );
                
                if (!basicUpdateResult) {
                        return { 
                                success: false, 
                                error: "INVALID_CONDITIONS",
                                message: "Insufficient coins or cooldown active"
                        };
                }
                
                // Now update hunt stats separately 
                const currentAnimal = basicUpdateResult.huntStats?.[animalKey];
                
                if (currentAnimal && currentAnimal.count) {
                        // Animal exists, increment count
                        await DataBase.ZiUser.updateOne(
                                { userID: userId },
                                {
                                        $inc: { [`huntStats.${animalKey}.count`]: 1 },
                                        $set: {
                                                [`huntStats.${animalKey}.lastCaught`]: now,
                                                [`huntStats.${animalKey}.emoji`]: huntResult.animal.emoji
                                        }
                                }
                        );
                } else {
                        // Animal doesn't exist, create new entry
                        await DataBase.ZiUser.updateOne(
                                { userID: userId },
                                {
                                        $set: {
                                                [`huntStats.${animalKey}`]: {
                                                        count: 1,
                                                        lastCaught: now,
                                                        emoji: huntResult.animal.emoji
                                                }
                                        }
                                }
                        );
                }

                // Update quest progress for hunting
                await updateQuestProgress(DataBase, userId, 'hunt', 1);
                
                // Get final user data
                const finalResult = await DataBase.ZiUser.findOne({ userID: userId });
                return { success: true, userData: finalResult };
                
        } catch (error) {
                console.error("Database update error:", error);
                console.error("Error details:", {
                        name: error.name,
                        message: error.message,
                        code: error.code,
                        userId: userId,
                        huntCost: huntCost,
                        huntResult: huntResult
                });
                return { success: false, error: error.message || "Database error" };
        }
}

async function showHuntError(interaction) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Lỗi hunt!`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Có lỗi xảy ra khi hunt.\n\n🔄 Vui lòng thử lại sau vài giây!`)
                .setFooter({ 
                        text: "Nếu vấn đề vẫn tiếp tục, hãy liên hệ admin!", 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

function checkLevelUp(oldUserData, newUserData) {
        if (!oldUserData || !newUserData) return { leveledUp: false };
        
        const oldLevel = oldUserData.level || 1;
        const newLevel = newUserData.level || 1;
        
        if (newLevel > oldLevel) {
                return {
                        leveledUp: true,
                        oldLevel,
                        newLevel,
                        levelUpReward: newLevel * 100
                };
        }
        
        return { leveledUp: false };
}

function checkLootbox(userDB, huntResult) {
        if (Math.random() <= LOOTBOX_CHANCE) {
                const rewards = animals.lootbox.rewards;
                const zigoldReward = Math.floor(Math.random() * (rewards.zigold.max - rewards.zigold.min + 1)) + rewards.zigold.min;
                const xpReward = Math.floor(Math.random() * (rewards.bonus_xp.max - rewards.bonus_xp.min + 1)) + rewards.bonus_xp.min;
                
                return {
                        found: true,
                        zigoldReward,
                        xpReward
                };
        }
        
        return { found: false };
}

async function sendHuntSuccessMessage(interaction, huntResult, xpReward, huntCost, userData, levelUpInfo, lootboxResult, lang) {
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
        
        // Determine embed color based on rarity
        const rarityColor = animals.rarities[huntResult.rarity].color;
        
        // Main embed
        const successEmbed = new EmbedBuilder()
                .setTitle(`${huntEmoji} ${gemEmoji} Hunt Success! ${sparkleEmoji}`)
                .setColor(rarityColor)
                .setDescription(`**${crownEmoji} ${userName}** đã hunt thành công!\n\n${rocketEmoji} *Cuộc săn thành công!*`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

        // Animal caught
        const rarityName = huntResult.rarity.charAt(0).toUpperCase() + huntResult.rarity.slice(1);
        const shinyText = huntResult.isShiny ? `${sparkleEmoji} **SHINY** ` : '';
        const animalText = `${shinyText}**${rarityName}** ${huntResult.animal.emoji} **${huntResult.animal.name}**\n💰 **Value:** \`${huntResult.animal.value.toLocaleString()}\` Zigold`;
        
        successEmbed.addFields({
                name: `${gemEmoji} ${sparkleEmoji} Animal Caught`,
                value: animalText,
                inline: false
        });

        // Hunt costs and rewards
        const costText = `${zigoldEmoji} **Hunt Cost:** \`-${huntCost.toLocaleString()}\` Zigold\n${starEmoji} **XP Gained:** \`+${xpReward}\` XP`;
        successEmbed.addFields({
                name: `📊 ${crownEmoji} Hunt Details`, 
                value: costText,
                inline: true
        });

        // User stats
        const statsText = `${zigoldEmoji} **Balance:** \`${userData.coin?.toLocaleString() || 0}\` Zigold\n${starEmoji} **Level:** \`${userData.level || 1}\`\n${gemEmoji} **Total Animals:** \`${userData.totalAnimals || 1}\``;
        successEmbed.addFields({
                name: `📊 ${crownEmoji} Your Stats`, 
                value: statsText,
                inline: true
        });

        // Level up notification
        if (levelUpInfo.leveledUp) {
                successEmbed.addFields({
                        name: `🎆 ${crownEmoji} LEVEL UP! ${sparkleEmoji} 🎆`,
                        value: `${rocketEmoji} **Level ${levelUpInfo.oldLevel}** ➜ **Level ${levelUpInfo.newLevel}** ${starEmoji}\n${zigoldEmoji} **Bonus:** \`+${levelUpInfo.levelUpReward.toLocaleString()}\` Zigold!\n${gemEmoji} *Bạn đã mạnh hơn rồi!*`,
                        inline: false
                });
        }

        // Lootbox notification
        if (lootboxResult.found) {
                successEmbed.addFields({
                        name: `📦 ${sparkleEmoji} LOOTBOX FOUND! ${gemEmoji}`,
                        value: `📦 **Lootbox:** \`+1\`\n${zigoldEmoji} **Bonus Zigold:** \`+${lootboxResult.zigoldReward.toLocaleString()}\`\n${starEmoji} **Bonus XP:** \`+${lootboxResult.xpReward}\`\n${rocketEmoji} *Use /lootbox to open it!*`,
                        inline: false
                });
        }

        // Footer with motivational message
        const motivationalMessages = [
                "Tiếp tục hunt để tìm animals hiếm!",
                "Hãy thu thập tất cả các loài!",
                "Bạn đang làm rất tốt!",
                "Level cao = animals hiếm hơn!",
                "Chúc bạn may mắn trong hunt tiếp theo!"
        ];
        const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        
        successEmbed.setFooter({
                text: `${huntEmoji} ${randomMessage} • ZiBot Hunt System`,
                iconURL: interaction.client.user.displayAvatarURL()
        });
        
        successEmbed.setTimestamp();

        // Action buttons
        const row = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_refProfile')
                                .setLabel('View Profile')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('👤'),
                        new ButtonBuilder()
                                .setCustomId('B_huntZoo')
                                .setLabel('Animal Collection')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('🦁'),
                        new ButtonBuilder()
                                .setCustomId('B_huntAgain')
                                .setLabel('Hunt Again')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(`${huntEmoji}`)
                );

        await interaction.reply({ embeds: [successEmbed], components: [row] });
}

async function handleCommandError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Lỗi hệ thống`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Đã xảy ra lỗi khi xử lý lệnh hunt.\n\n🔄 **Vui lòng thử lại sau** hoặc liên hệ admin nếu vấn đề vẫn tiếp tục!\n\n${rocketEmoji} *Chúng tôi đang làm việc để khắc phục sự cố.*`)
                .addFields({
                        name: "🛠️ Hướng dẫn khắc phục",
                        value: `• Đợi vài giây rồi thử lại\n• Kiểm tra kết nối mạng\n• Liên hệ admin nếu cần hỗ trợ`,
                        inline: false
                })
                .setFooter({ 
                        text: `${sparkleEmoji} ZiBot luôn cố gắng mang đến trải nghiệm tốt nhất!`, 
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