const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB, useConfig } = require("@zibot/zihooks");
const animals = require("../../data/animals.json");

const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const gemEmoji = "💎"; // Biểu tượng kim cương
const crownEmoji = "👑"; // Biểu tượng vương miện
const starEmoji = "⭐"; // Biểu tượng ngôi sao
const rocketEmoji = "🚀"; // Biểu tượng tên lửa

module.exports.data = {
        name: "zoo",
        description: "Xem collection animals của bạn!",
        type: 1,
        options: [
                {
                        type: 6,
                        name: "user",
                        description: "Xem zoo của user khác",
                        required: false
                },
                {
                        type: 3,
                        name: "rarity",
                        description: "Lọc theo độ hiếm",
                        required: false,
                        choices: [
                                { name: "Common", value: "common" },
                                { name: "Uncommon", value: "uncommon" },
                                { name: "Rare", value: "rare" },
                                { name: "Epic", value: "epic" },
                                { name: "Legendary", value: "legendary" }
                        ]
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

                const targetUser = interaction.options?.getUser("user") || interaction.user;
                const filterRarity = interaction.options?.getString("rarity");
                const userId = targetUser.id;

                // Lấy dữ liệu người dùng
                const userDB = await DataBase.ZiUser.findOne({ userID: userId });
                
                if (!userDB || !userDB.huntStats || Object.keys(userDB.huntStats).length === 0) {
                        return await showEmptyZoo(interaction, targetUser);
                }

                // Xử lý và hiển thị sở thú
                await showZooCollection(interaction, targetUser, userDB, filterRarity);

        } catch (error) {
                console.error("Error in zoo command:", error);
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

async function showEmptyZoo(interaction, targetUser) {
        const isOwnZoo = targetUser.id === interaction.user.id;
        const userName = targetUser.globalName || targetUser.username;
        
        const emptyEmbed = new EmbedBuilder()
                .setTitle(`🦁 ${gemEmoji} ${isOwnZoo ? "Your" : userName + "'s"} Zoo Collection`)
                .setColor("#95A5A6")
                .setDescription(
                        isOwnZoo 
                        ? `**${sparkleEmoji} Zoo của bạn đang trống!**\n\n🏹 Sử dụng \`/hunt\` để bắt đầu thu thập animals!\n${rocketEmoji} Hãy trở thành master hunter!`
                        : `**${sparkleEmoji} ${userName} chưa có animals nào!**\n\n🏹 Khuyến khích họ sử dụng \`/hunt\` để bắt đầu!`
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                        text: `${sparkleEmoji} Bắt đầu cuộc phiêu lưu hunt ngay hôm nay! • ZiBot Zoo`,
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

        const row = isOwnZoo ? new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_startHunt')
                                .setLabel('Start Hunting!')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🏹')
                ) : null;

        return await interaction.reply({ embeds: [emptyEmbed], components: row ? [row] : [] });
}

async function showZooCollection(interaction, targetUser, userDB, filterRarity) {
        const isOwnZoo = targetUser.id === interaction.user.id;
        const userName = targetUser.globalName || targetUser.username;
        
        // Process animals collection from huntStats
        const userHuntStats = userDB.huntStats || {};
        let totalAnimals = 0;
        let totalValue = 0;
        let rarityStats = {
                common: 0,
                uncommon: 0,
                rare: 0,
                epic: 0,
                legendary: 0
        };

        // Calculate stats and filter animals
        const displayAnimals = [];
        
        // Convert huntStats format to displayable format
        for (const [huntKey, huntData] of Object.entries(userHuntStats)) {
                if (!huntData || !huntData.count || huntData.count <= 0) continue;
                
                // Parse hunt key: "rarity_animalname"
                const parts = huntKey.split('_');
                const rarity = parts[0];
                const animalName = parts.slice(1).join('_'); // Handle names with underscores
                
                if (!animals[rarity]) continue; // Skip invalid rarities
                if (filterRarity && rarity !== filterRarity) continue;
                
                // Find animal data
                const animalData = animals[rarity].find(a => a.name === animalName);
                if (animalData) {
                        const count = huntData.count;
                        totalAnimals += count;
                        totalValue += animalData.value * count;
                        rarityStats[rarity] += count;
                        
                        displayAnimals.push({
                                rarity,
                                ...animalData,
                                count,
                                lastCaught: huntData.lastCaught
                        });
                }
        }

        // Sort animals by rarity and value
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        displayAnimals.sort((a, b) => {
                const rarityDiff = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
                if (rarityDiff !== 0) return rarityDiff;
                return b.value - a.value;
        });

        // Create embed
        const rarityColors = {
                legendary: "#FFD700",
                epic: "#9C27B0",
                rare: "#2196F3",
                uncommon: "#4CAF50",
                common: "#9E9E9E"
        };
        const rarityColor = filterRarity ? rarityColors[filterRarity] : "#3498DB";
        const embed = new EmbedBuilder()
                .setTitle(`🦁 ${gemEmoji} ${isOwnZoo ? "Your" : userName + "'s"} Zoo Collection ${filterRarity ? `(${filterRarity.charAt(0).toUpperCase() + filterRarity.slice(1)})` : ""}`)
                .setColor(rarityColor)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

        // Add description with stats
        let description = `**${crownEmoji} Collection Stats:**\n`;
        description += `${sparkleEmoji} **Total Animals:** \`${totalAnimals.toLocaleString()}\`\n`;
        description += `${zigoldEmoji} **Total Value:** \`${totalValue.toLocaleString()}\` Zigold\n`;
        description += `${starEmoji} **User Level:** \`${userDB.level || 1}\`\n\n`;

        // Add rarity breakdown
        description += `**${gemEmoji} Rarity Breakdown:**\n`;
        for (const [rarity, count] of Object.entries(rarityStats)) {
                if (count > 0) {
                        const rarityIcon = getRarityIcon(rarity);
                        description += `${rarityIcon} **${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:** \`${count}\`\n`;
                }
        }

        embed.setDescription(description);

        // Add animals fields with improved display
        const pageSize = 12;
        const displayCount = Math.min(displayAnimals.length, pageSize);
        
        if (displayCount > 0) {
                let animalsText = "";
                for (let i = 0; i < displayCount; i++) {
                        const animal = displayAnimals[i];
                        const rarityIcon = getRarityIcon(animal.rarity);
                        const totalValue = animal.value * animal.count;
                        animalsText += `${rarityIcon} ${animal.emoji} **${animal.name}** \`x${animal.count}\`\n`;
                        animalsText += `└ ${totalValue.toLocaleString()} ${zigoldEmoji} total (${animal.value.toLocaleString()} each)\n`;
                }
                
                embed.addFields({
                        name: `${sparkleEmoji} Animals Collection ${displayAnimals.length > pageSize ? `(Showing ${displayCount}/${displayAnimals.length})` : ""}`,
                        value: animalsText,
                        inline: false
                });
                
                if (displayAnimals.length > pageSize) {
                        embed.addFields({
                                name: `${rocketEmoji} Collection Note`,
                                value: `*Showing top ${pageSize} most valuable animals.*\n*Use rarity filters to see more specific collections!*`,
                                inline: false
                        });
                }
        } else {
                embed.addFields({
                        name: `${sparkleEmoji} No Animals Found`,
                        value: filterRarity 
                                ? `*Không có ${filterRarity} animals nào trong collection!*\n*Hãy hunt để tìm ${filterRarity} animals!*`
                                : `*Zoo trống! Hãy bắt đầu hunt để có animals đầu tiên!*`,
                        inline: false
                });
        }

        // Footer
        embed.setFooter({
                text: `${sparkleEmoji} ${isOwnZoo ? "Tiếp tục hunt để mở rộng collection!" : "Gửi lời chúc may mắn cho " + userName + "!"} • ZiBot Zoo`,
                iconURL: interaction.client.user.displayAvatarURL()
        });
        
        embed.setTimestamp();

        // Action buttons
        const row = new ActionRowBuilder();
        
        if (isOwnZoo) {
                row.addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_startHunt')
                                .setLabel('Hunt More')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🏹'),
                        new ButtonBuilder()
                                .setCustomId('B_sellAnimals')
                                .setLabel('Sell Animals')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('💰')
                );
        }
        
        // Rarity filter buttons
        const rarityRow = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_filterAll')
                                .setLabel('All')
                                .setStyle(filterRarity ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setEmoji('🔍'),
                        new ButtonBuilder()
                                .setCustomId('B_filterLegendary')
                                .setLabel('Legendary')
                                .setStyle(filterRarity === 'legendary' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setEmoji('👑'),
                        new ButtonBuilder()
                                .setCustomId('B_filterEpic')
                                .setLabel('Epic')
                                .setStyle(filterRarity === 'epic' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setEmoji('💜'),
                        new ButtonBuilder()
                                .setCustomId('B_filterRare')
                                .setLabel('Rare')
                                .setStyle(filterRarity === 'rare' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setEmoji('💙'),
                        new ButtonBuilder()
                                .setCustomId('B_filterCommon')
                                .setLabel('Common+')
                                .setStyle(filterRarity === 'common' || filterRarity === 'uncommon' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setEmoji('💚')
                );

        const components = [];
        if (row.components.length > 0) components.push(row);
        components.push(rarityRow);

        await interaction.reply({ embeds: [embed], components });
}

function getRarityIcon(rarity) {
        const icons = {
                'common': '⚪',
                'uncommon': '🌟', 
                'rare': '⚡',
                'epic': '🔮',
                'legendary': '💎'
        };
        return icons[rarity] || '⚪';
}

async function handleCommandError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Lỗi hệ thống`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Đã xảy ra lỗi khi xem zoo.\n\n🔄 **Vui lòng thử lại sau** hoặc liên hệ admin nếu vấn đề vẫn tiếp tục!\n\n${rocketEmoji} *Chúng tôi đang làm việc để khắc phục sự cố.*`)
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