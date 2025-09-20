const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB, useConfig } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");
const { updateQuestProgress } = require("./quests");

const BATTLE_COOLDOWN = 25 * 1000; // 25 giây
const BATTLE_ENTRY_COST = 150; // Chi phí Zigold để tham gia chiến đấu

const battleEmoji = "⚔️"; // Biểu tượng chiến đấu
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold  
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const gemEmoji = "💎"; // Biểu tượng đá quý
const crownEmoji = "👑"; // Biểu tượng vương miện
const starEmoji = "⭐"; // Biểu tượng ngôi sao
const rocketEmoji = "🚀"; // Biểu tượng tên lửa
const shieldEmoji = "🛡️"; // Biểu tượng khiên
const swordEmoji = "⚔️"; // Biểu tượng kiếm

module.exports.data = {
        name: "battle",
        description: "Chiến đấu với animals của bạn để kiếm Zigold và XP!",
        type: 1,
        options: [
                {
                        type: 6,
                        name: "opponent",
                        description: "Challenge một user khác",
                        required: false
                }
        ],
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

                const opponent = interaction.options?.getUser("opponent");
                
                if (opponent) {
                        // Chiến đấu Người với Người
                        return await initiatePvPBattle(interaction, opponent, DataBase, ZiRank);
                } else {
                        // Chiến đấu Người với Máy (chống lại AI)
                        return await initiatePvEBattle(interaction, DataBase, ZiRank);
                }

        } catch (error) {
                console.error("Error in battle command:", error);
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
        
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

async function initiatePvPBattle(interaction, opponent, DataBase, ZiRank) {
        // Check if challenging self
        if (opponent.id === interaction.user.id) {
                return await showCannotChallengeSelf(interaction);
        }

        // Check if opponent is bot
        if (opponent.bot) {
                return await showCannotChallengeBot(interaction);
        }

        // Get both users' data
        const [challengerData, opponentData] = await Promise.all([
                DataBase.ZiUser.findOne({ userID: interaction.user.id }),
                DataBase.ZiUser.findOne({ userID: opponent.id })
        ]);

        // Check if users have animals
        if (!challengerData?.huntStats || !hasValidTeam(challengerData.huntStats)) {
                return await showNoAnimalsError(interaction, true);
        }

        if (!opponentData?.huntStats || !hasValidTeam(opponentData.huntStats)) {
                return await showOpponentNoAnimalsError(interaction, opponent);
        }

        // Show PvP challenge
        await showPvPChallenge(interaction, opponent, challengerData, opponentData);
}

async function initiatePvEBattle(interaction, DataBase, ZiRank) {
        const userId = interaction.user.id;
        const now = new Date();

        // Get user data
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });

        // Check cooldown
        const cooldownCheck = checkBattleCooldown(userDB, now);
        if (cooldownCheck.onCooldown) {
                return await showCooldownMessage(interaction, cooldownCheck);
        }

        // Check if user has animals
        if (!userDB?.huntStats || !hasValidTeam(userDB.huntStats)) {
                return await showNoAnimalsError(interaction, false);
        }

        // Check if user has enough Zigold
        if (!userDB || (userDB.coin || 0) < BATTLE_ENTRY_COST) {
                return await showInsufficientFunds(interaction, BATTLE_ENTRY_COST, userDB?.coin || 0);
        }

        // Simulate PvE battle
        const battleResult = simulatePvEBattle(userDB);
        
        // Update user data
        await updateUserBattle(DataBase, userId, now, battleResult, ZiRank, userDB);
        
        // Show battle result
        await showBattleResult(interaction, battleResult, userDB);
}

function checkBattleCooldown(userDB, now) {
        if (!userDB?.lastBattle) {
                return { onCooldown: false };
        }

        const lastBattle = new Date(userDB.lastBattle);
        const timeDiff = now.getTime() - lastBattle.getTime();
        
        if (timeDiff < BATTLE_COOLDOWN) {
                const timeLeft = BATTLE_COOLDOWN - timeDiff;
                const secondsLeft = Math.ceil(timeLeft / 1000);
                
                return {
                        onCooldown: true,
                        timeLeft: { seconds: secondsLeft },
                        totalTimeLeft: timeLeft
                };
        }
        
        return { onCooldown: false };
}

async function showCooldownMessage(interaction, cooldownCheck) {
        const { seconds } = cooldownCheck.timeLeft;
        
        const cooldownEmbed = new EmbedBuilder()
                .setTitle(`⏰ ${battleEmoji} Battle Cooldown ${sparkleEmoji}`)
                .setColor("#FF6B9D")
                .setDescription(`**${sparkleEmoji} Bạn đã battle gần đây!**\n\n🎯 Animals của bạn đang nghỉ ngơi ${gemEmoji}`)
                .addFields({
                        name: `⏳ ${sparkleEmoji} Thời gian còn lại`,
                        value: `\`\`\`${seconds} giây\`\`\``,
                        inline: true
                })
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                        text: `${battleEmoji} Hãy chuẩn bị chiến thuật cho battle tiếp theo! • ZiBot Battle System`,
                        iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

        return await interaction.reply({ embeds: [cooldownEmbed], flags: 64 });
}

function hasValidTeam(huntStats) {
        let totalAnimals = 0;
        for (const [animalKey, animalData] of Object.entries(huntStats)) {
                // animalKey format: "rarity_animalname" (e.g., "common_dog")
                if (animalData && animalData.count) {
                        totalAnimals += animalData.count || 0;
                }
        }
        return totalAnimals >= 1; // Need at least 1 animal
}

async function showNoAnimalsError(interaction, isChallenger) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Không có animals!`)
                .setColor("#FF4757")
                .setDescription(`**${sparkleEmoji} ${isChallenger ? "Bạn" : "Bạn"} cần ít nhất 1 animal để battle!**\n\n🏹 Sử dụng \`/hunt\` để bắt animals trước!\n${rocketEmoji} Hãy tạo đội hình mạnh mẽ!`)
                .setFooter({ 
                        text: `${battleEmoji} Hunt animals để bắt đầu battle! • ZiBot Battle System`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

async function showOpponentNoAnimalsError(interaction, opponent) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Đối thủ không có animals!`)
                .setColor("#FF4757")
                .setDescription(`**${sparkleEmoji} ${opponent.username} chưa có animals để battle!**\n\n🏹 Họ cần hunt animals trước!\n${rocketEmoji} Hãy challenge người khác hoặc battle PvE!`)
                .setFooter({ 
                        text: `${battleEmoji} Tìm đối thủ xứng tầm khác! • ZiBot Battle System`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

async function showCannotChallengeSelf(interaction) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Không thể tự battle!`)
                .setColor("#FF4757")
                .setDescription(`**${sparkleEmoji} Bạn không thể challenge chính mình!**\n\n${battleEmoji} Sử dụng \`\`\`text\n/battle\n\`\`\` không có opponent để battle PvE!\n${rocketEmoji} Hoặc tag một user khác để challenge!`)
                .setFooter({ 
                        text: `${battleEmoji} Hãy tìm đối thủ xứng tầm! • ZiBot Battle System`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

async function showCannotChallengeBot(interaction) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Không thể challenge bot!`)
                .setColor("#FF4757")
                .setDescription(`**${sparkleEmoji} Bạn không thể challenge bot!**\n\n${battleEmoji} Sử dụng \`\`\`text\n/battle\n\`\`\` để battle PvE!\n${rocketEmoji} Hoặc challenge một user thật!`)
                .setFooter({ 
                        text: `${battleEmoji} Hãy challenge đối thủ là con người! • ZiBot Battle System`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

async function showInsufficientFunds(interaction, battleCost, userCoin) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Không đủ Zigold!`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Bạn cần **${battleCost.toLocaleString()}** ${zigoldEmoji} Zigold để battle!\n\n💰 **Số dư hiện tại:** ${userCoin.toLocaleString()} ${zigoldEmoji}\n\n🔄 Hãy claim daily hoặc hunt để kiếm thêm Zigold!`)
                .setFooter({ 
                        text: `${battleEmoji} Sử dụng /daily để nhận Zigold miễn phí!`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
}

function simulatePvEBattle(userDB) {
        // Get user's strongest animals
        const userTeam = buildUserTeam(userDB.huntStats);
        
        // Generate AI opponent based on user level
        const aiTeam = generateAIOpponent(userDB.level || 1);
        
        // Calculate team powers
        const userPower = calculateTeamPower(userTeam);
        const aiPower = calculateTeamPower(aiTeam);
        
        // Add some randomness (±20%)
        const userRoll = userPower * (0.8 + Math.random() * 0.4);
        const aiRoll = aiPower * (0.8 + Math.random() * 0.4);
        
        const userWins = userRoll > aiRoll;
        const powerRatio = userRoll / aiRoll;
        
        // Calculate rewards based on performance
        const baseZigold = BATTLE_ENTRY_COST;
        const baseXP = 50;
        
        if (userWins) {
                const winMultiplier = Math.min(powerRatio, 2.0); // Max 2x for overwhelming victory
                return {
                        victory: true,
                        zigoldReward: Math.floor(baseZigold * (1.5 + winMultiplier * 0.5)),
                        xpReward: Math.floor(baseXP * (1.2 + winMultiplier * 0.3)),
                        userTeam,
                        aiTeam,
                        userPower: Math.floor(userRoll),
                        aiPower: Math.floor(aiRoll),
                        battleCost: BATTLE_ENTRY_COST
                };
        } else {
                // Consolation rewards for losing
                return {
                        victory: false,
                        zigoldReward: Math.floor(baseZigold * 0.3), // 30% refund
                        xpReward: Math.floor(baseXP * 0.5), // 50% XP for effort
                        userTeam,
                        aiTeam,
                        userPower: Math.floor(userRoll),
                        aiPower: Math.floor(aiRoll),
                        battleCost: BATTLE_ENTRY_COST
                };
        }
}

function buildUserTeam(huntStats) {
        const team = [];
        
        // Prioritize by rarity and power
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        
        // Convert huntStats to organized structure for processing
        const organizedAnimals = {};
        for (const [animalKey, animalData] of Object.entries(huntStats)) {
                if (!animalData || !animalData.count || animalData.count <= 0) continue;
                
                // Parse rarity and animal name from key (format: "rarity_animalname")
                const parts = animalKey.split('_');
                if (parts.length < 2) continue;
                
                const rarity = parts[0];
                const animalName = parts.slice(1).join('_'); // Handle animal names with underscores
                
                if (!organizedAnimals[rarity]) {
                        organizedAnimals[rarity] = {};
                }
                organizedAnimals[rarity][animalName] = animalData.count;
        }
        
        // Build team using organized data
        for (const rarity of rarityOrder) {
                if (!organizedAnimals[rarity]) continue;
                
                for (const [animalName, count] of Object.entries(organizedAnimals[rarity])) {
                        if (count > 0) {
                                const animalData = animals[rarity]?.find(a => a.name === animalName);
                                if (animalData) {
                                        team.push({
                                                ...animalData,
                                                rarity,
                                                count: Math.min(count, 3) // Max 3 of same animal in battle
                                        });
                                }
                        }
                        if (team.length >= 5) break; // Max team size
                }
                if (team.length >= 5) break;
        }
        
        return team.slice(0, 5); // Ensure max 5 animals
}

function generateAIOpponent(userLevel) {
        const team = [];
        const teamSize = Math.min(3 + Math.floor(userLevel / 20), 5); // Scale with user level
        
        // Generate AI team based on user level
        for (let i = 0; i < teamSize; i++) {
                const rarity = selectAIAnimalRarity(userLevel);
                const availableAnimals = animals[rarity];
                const selectedAnimal = availableAnimals[Math.floor(Math.random() * availableAnimals.length)];
                
                team.push({
                        ...selectedAnimal,
                        rarity,
                        count: 1
                });
        }
        
        return team;
}

function selectAIAnimalRarity(userLevel) {
        // AI gets better animals as user level increases
        const levelBonus = Math.min(userLevel * 0.01, 0.3); // Max 30% bonus
        
        const adjustedChances = {
                'common': Math.max(0.4 - levelBonus, 0.1),
                'uncommon': Math.max(0.3 - levelBonus * 0.5, 0.2),
                'rare': Math.min(0.2 + levelBonus * 0.5, 0.4),
                'epic': Math.min(0.08 + levelBonus * 0.8, 0.2),
                'legendary': Math.min(0.02 + levelBonus, 0.1)
        };
        
        const rand = Math.random();
        let cumulative = 0;
        
        for (const [rarity, chance] of Object.entries(adjustedChances)) {
                cumulative += chance;
                if (rand <= cumulative) {
                        return rarity;
                }
        }
        
        return 'common';
}

function calculateTeamPower(team) {
        return team.reduce((total, animal) => {
                const rarityMultiplier = {
                        'common': 1.0,
                        'uncommon': 1.5,
                        'rare': 2.5,
                        'epic': 4.0,
                        'legendary': 7.0
                }[animal.rarity] || 1.0;
                
                return total + (animal.value * rarityMultiplier * animal.count);
        }, 0);
}

async function updateUserBattle(DataBase, userId, now, battleResult, ZiRank, oldUserData) {
        try {
                // Update user data
                await DataBase.ZiUser.findOneAndUpdate(
                        { userID: userId },
                        {
                                $set: { 
                                        lastBattle: now,
                                        name: userId
                                },
                                $inc: { 
                                        coin: battleResult.zigoldReward - battleResult.battleCost,
                                        [`battleStats.${battleResult.victory ? 'wins' : 'losses'}`]: 1,
                                        'battleStats.total': 1
                                },
                                $setOnInsert: {
                                        level: 1,
                                        xp: 1,
                                        volume: 100,
                                        color: "Random"
                                }
                        },
                        { 
                                new: true, 
                                upsert: true,
                                setDefaultsOnInsert: true
                        }
                );

                // Update quest progress for battle wins
                if (battleResult.victory) {
                        await updateQuestProgress(DataBase, userId, 'battle', 1);
                }
                
                // Add XP through ZiRank
                await ZiRank.execute({ 
                        user: { id: userId }, 
                        XpADD: battleResult.xpReward,
                        CoinADD: 0
                });
                
        } catch (error) {
                console.error("Database update error:", error);
        }
}

async function showBattleResult(interaction, battleResult, userDB) {
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
        
        // Determine embed color based on result
        const resultColor = battleResult.victory ? "#2ECC71" : "#E74C3C";
        const resultIcon = battleResult.victory ? "🎉" : "💔";
        const resultTitle = battleResult.victory ? "VICTORY!" : "DEFEAT";
        
        // Main embed
        const battleEmbed = new EmbedBuilder()
                .setTitle(`${battleEmoji} ${gemEmoji} Battle Complete! ${resultIcon}`)
                .setColor(resultColor)
                .setDescription(`**${crownEmoji} ${userName}** ${battleResult.victory ? "đã chiến thắng" : "đã thua cuộc"}!\n\n${rocketEmoji} *${resultTitle}*`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

        // Battle details
        const powerComparison = `${swordEmoji} **Your Power:** \`${battleResult.userPower.toLocaleString()}\`\n${shieldEmoji} **Enemy Power:** \`${battleResult.aiPower.toLocaleString()}\``;
        battleEmbed.addFields({
                name: `${sparkleEmoji} Battle Analysis`,
                value: powerComparison,
                inline: false
        });

        // Rewards
        const rewardsText = `${zigoldEmoji} **Zigold:** \`${battleResult.zigoldReward > 0 ? '+' : ''}${(battleResult.zigoldReward - battleResult.battleCost).toLocaleString()}\` (Entry: -${battleResult.battleCost.toLocaleString()})\n${starEmoji} **XP Gained:** \`+${battleResult.xpReward}\``;
        battleEmbed.addFields({
                name: `💰 ${gemEmoji} Battle Rewards`,
                value: rewardsText,
                inline: true
        });

        // Team display (your team)
        const yourTeamText = battleResult.userTeam.slice(0, 3).map(animal => 
                `${animal.emoji} **${animal.name}** ${animal.count > 1 ? `x${animal.count}` : ''}`
        ).join('\n') || 'No team data';
        
        battleEmbed.addFields({
                name: `${swordEmoji} Your Team`,
                value: yourTeamText,
                inline: true
        });

        // Enemy team display
        const enemyTeamText = battleResult.aiTeam.slice(0, 3).map(animal => 
                `${animal.emoji} **${animal.name}**`
        ).join('\n') || 'No enemy data';
        
        battleEmbed.addFields({
                name: `${shieldEmoji} Enemy Team`,
                value: enemyTeamText,
                inline: true
        });

        // Battle stats
        const battleStats = userDB.battleStats || { wins: 0, losses: 0, total: 0 };
        const winRate = battleStats.total > 0 ? Math.round((battleStats.wins / battleStats.total) * 100) : 0;
        const statsText = `🏆 **Wins:** \`${battleStats.wins + (battleResult.victory ? 1 : 0)}\`\n💀 **Losses:** \`${battleStats.losses + (battleResult.victory ? 0 : 1)}\`\n📊 **Win Rate:** \`${winRate}%\``;
        
        battleEmbed.addFields({
                name: `📊 ${crownEmoji} Battle Stats`,
                value: statsText,
                inline: false
        });

        // Footer with encouragement
        const encouragements = {
                victory: [
                        "Excellent strategy!",
                        "Your animals fought bravely!",
                        "Victory tastes sweet!",
                        "A well-deserved win!",
                        "Champion in the making!"
                ],
                defeat: [
                        "Better luck next time!",
                        "Learn from this battle!",
                        "Train harder for victory!",
                        "Every defeat makes you stronger!",
                        "Comeback time!"
                ]
        };
        
        const messages = encouragements[battleResult.victory ? 'victory' : 'defeat'];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        battleEmbed.setFooter({
                text: `${battleEmoji} ${randomMessage} • ZiBot Battle System`,
                iconURL: interaction.client.user.displayAvatarURL()
        });
        
        battleEmbed.setTimestamp();

        // Action buttons
        const row = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_battleAgain')
                                .setLabel('Battle Again')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(battleEmoji),
                        new ButtonBuilder()
                                .setCustomId('B_viewTeam')
                                .setLabel('View Team')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('👥'),
                        new ButtonBuilder()
                                .setCustomId('B_huntMore')
                                .setLabel('Hunt More')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('🏹')
                );

        await interaction.reply({ embeds: [battleEmbed], components: [row] });
}

async function showPvPChallenge(interaction, opponent, challengerData, opponentData) {
        // For now, just show that PvP is coming soon
        const pvpEmbed = new EmbedBuilder()
                .setTitle(`${battleEmoji} ${gemEmoji} PvP Challenge`)
                .setColor("#9B59B6")
                .setDescription(`**${sparkleEmoji} PvP battles đang được phát triển!**\n\n🚧 **Coming Soon:**\n• Player vs Player battles\n• Tournament system\n• Betting system\n• Guild wars\n\n${battleEmoji} Hiện tại hãy sử dụng \`/battle\` để battle PvE!`)
                .setFooter({ 
                        text: `${sparkleEmoji} PvP system sẽ có trong update tiếp theo! • ZiBot Battle System`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [pvpEmbed], flags: 64 });
}

async function handleCommandError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Lỗi hệ thống`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Đã xảy ra lỗi khi battle.\n\n🔄 **Vui lòng thử lại sau** hoặc liên hệ admin nếu vấn đề vẫn tiếp tục!\n\n${rocketEmoji} *Chúng tôi đang làm việc để khắc phục sự cố.*`)
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
        
        const errorResponse = { embeds: [errorEmbed], flags: 64 };
        
        if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse).catch(() => {});
        } else {
                await interaction.reply(errorResponse).catch(() => {});
        }
}