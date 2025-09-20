const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const { updateQuestProgress } = require("./quests");

const maxBet = 250000;
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const wheelEmoji = "🎡"; // Biểu tượng bánh xe
const fireEmoji = "🔥"; // Biểu tượng lửa
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const trophyEmoji = "🏆"; // Biểu tượng cúp
const rocketEmoji = "🚀"; // Biểu tượng tên lửa
const gemEmoji = "💎"; // Biểu tượng đá quý

// Các phân đoạn của bánh xe với tỉ lệ và hệ số nhân cân bằng (lợi thế nhà cái 2.4%)
const wheelSegments = [
    { emoji: "💸", name: "Lose All", multiplier: 0, weight: 12, color: "#FF4757" },
    { emoji: "😢", name: "Lose Half", multiplier: 0.5, weight: 25, color: "#FF6B6B" },
    { emoji: "🤏", name: "Small Win", multiplier: 1.2, weight: 43, color: "#FFA502" },
    { emoji: "😊", name: "Good Win", multiplier: 1.5, weight: 15, color: "#26D0CE" },
    { emoji: "🎉", name: "Great Win", multiplier: 2, weight: 4, color: "#3742FA" },
    { emoji: "💰", name: "Big Win", multiplier: 3, weight: 1, color: "#2ED573" }
];

module.exports.data = {
    name: "wheel",
    description: "Quay bánh xe may mắn để nhân đôi ZiGold của bạn!",
    type: 1,
    options: [
        {
            name: "bet",
            description: "Số ZiGold muốn cược (mặc định: 100)",
            type: 4,
            required: false,
            min_value: 1,
            max_value: maxBet,
        },
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

        // Kiểm tra xem cơ sở dữ liệu và các hàm được khởi tạo đúng cách
        if (!DataBase || !DataBase.ZiUser || !ZiRank) {
            return await handleInitializationError(interaction, !DataBase);
        }

        let bet = interaction.options.getInteger("bet") || 100;
        const userId = interaction.user.id;
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

        // Xác thực số tiền cược
        if (bet <= 0) {
            return await showInvalidBetError(interaction);
        }

        if (bet > maxBet) {
            bet = maxBet;
        }

        await interaction.deferReply();

        // Hiển thị hoạt hình quay
        await showSpinningAnimation(interaction, userName, bet);

        // Chọn phân đoạn ngẫu nhiên dựa trên trọng số
        const selectedSegment = selectRandomSegment();
        const winAmount = Math.floor(bet * selectedSegment.multiplier);
        const netGain = winAmount - bet;

        // Atomic transaction: check balance and update in one operation
        const userUpdate = await DataBase.ZiUser.findOneAndUpdate(
            { 
                userID: userId, 
                coin: { $gte: bet } // Ensure sufficient balance
            },
            { $inc: { coin: netGain } },
            { new: true } // Return updated document
        );

        if (!userUpdate) {
            // Either user doesn't exist or insufficient funds
            const userDB = await DataBase.ZiUser.findOne({ userID: userId });
            if (!userDB) {
                return await showUserNotFoundError(interaction);
            } else {
                return await showInsufficientFundsError(interaction, userDB.coin, bet);
            }
        }

        // Show final result
        await showWheelResult(interaction, selectedSegment, bet, winAmount, netGain);

        // Update quest progress for gambling wins (multiplier > 1 means win)
        if (selectedSegment.multiplier > 1) {
            await updateQuestProgress(DataBase, userId, 'gamble', 1);
        }
        
        // Give XP based on result
        let xpReward = 5;
        if (selectedSegment.multiplier >= 3) xpReward = 15;
        else if (selectedSegment.multiplier >= 2) xpReward = 10;

        await ZiRank.execute({
            user: interaction.user,
            XpADD: xpReward,
            CoinADD: 0
        });

    } catch (error) {
        console.error("Error in wheel command:", error);
        await handleCommandError(interaction, error);
    }
};

function selectRandomSegment() {
    // Calculate total weight
    const totalWeight = wheelSegments.reduce((sum, segment) => sum + segment.weight, 0);
    
    // Generate random number
    let random = Math.floor(Math.random() * totalWeight);
    
    // Find which segment this falls into
    for (const segment of wheelSegments) {
        random -= segment.weight;
        if (random < 0) {
            return segment;
        }
    }
    
    // Fallback (should never happen)
    return wheelSegments[0];
}

async function showSpinningAnimation(interaction, userName, bet) {
    const animations = [
        `${wheelEmoji} **Spinning...** 🌀`,
        `${wheelEmoji} **Spinning...** 🔄`,
        `${wheelEmoji} **Spinning...** ⚡`,
        `${wheelEmoji} **Almost there...** ${sparkleEmoji}`
    ];

    for (let i = 0; i < animations.length; i++) {
        const spinningEmbed = new EmbedBuilder()
            .setTitle(`${wheelEmoji} Wheel of Fortune`)
            .setColor("#FFD700")
            .setDescription(`${sparkleEmoji} **${userName}** đang quay bánh xe...\n\n💰 **Cược:** ${bet.toLocaleString()} ZiGold\n\n${animations[i]}`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: "Bánh xe đang quay...", 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [spinningEmbed] });
        
        if (i < animations.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

async function showWheelResult(interaction, segment, bet, winAmount, netGain) {
    const isWin = segment.multiplier > 1;
    const isBigWin = segment.multiplier >= 3;

    let description = `${sparkleEmoji} **Bánh xe đã dừng!**\n\n`;
    description += `🎯 **Kết quả:** ${segment.emoji} ${segment.name}\n`;
    description += `⚡ **Multiplier:** x${segment.multiplier}\n\n`;

    if (segment.multiplier === 0) {
        description += `💸 **Mất tất cả!** \n`;
        description += `📉 **Mất:** ${bet.toLocaleString()} ZiGold`;
    } else if (segment.multiplier < 1) {
        description += `😢 **Mất một nửa!** \n`;
        description += `💰 **Nhận về:** ${winAmount.toLocaleString()} ZiGold\n`;
        description += `📉 **Mất:** ${Math.abs(netGain).toLocaleString()} ZiGold`;
    } else if (segment.multiplier === 1) {
        description += `🤝 **Hòa!** \n`;
        description += `💰 **Nhận lại:** ${winAmount.toLocaleString()} ZiGold`;
    } else {
        description += `${trophyEmoji} **THẮNG!** ${isBigWin ? fireEmoji : ""}\n`;
        description += `💰 **Tiền thắng:** ${winAmount.toLocaleString()} ZiGold\n`;
        description += `📈 **Lợi nhuận:** +${netGain.toLocaleString()} ZiGold`;
    }

    const embedColor = isBigWin ? "#2ED573" : isWin ? "#26D0CE" : "#FF4757";

    const embed = new EmbedBuilder()
        .setTitle(`${wheelEmoji} Wheel of Fortune Result`)
        .setColor(embedColor)
        .setDescription(description)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    // Add special message for big wins
    if (isBigWin) {
        embed.addFields({
            name: `${fireEmoji} Big Win! ${fireEmoji}`,
            value: `Thắng lớn với x${segment.multiplier} multiplier!`,
            inline: false
        });
        embed.setFooter({ 
            text: `Big Winner! • +15 XP`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        });
    } else {
        const xpReward = isWin ? 10 : 5;
        embed.setFooter({ 
            text: `${isWin ? "Chúc mừng!" : "Thử lại lần sau!"} • +${xpReward} XP`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function showInvalidBetError(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("❌ Lỗi cược")
        .setColor("#FF4757")
        .setDescription("Bạn không thể cược số tiền <= 0!");
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showUserNotFoundError(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("❌ Người dùng không tìm thấy")
        .setColor("#FF4757")
        .setDescription("Không tìm thấy dữ liệu của bạn trong hệ thống. Hãy sử dụng một số lệnh khác trước!");
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showInsufficientFundsError(interaction, currentBalance, betAmount) {
    const embed = new EmbedBuilder()
        .setTitle("❌ Không đủ ZiGold")
        .setColor("#FF4757")
        .setDescription(`💸 **Bạn không có đủ ZiGold để cược!**\n\n💰 **Số dư hiện tại:** ${currentBalance.toLocaleString()} ZiGold\n🎯 **Số tiền cược:** ${betAmount.toLocaleString()} ZiGold\n🔍 **Thiếu:** ${(betAmount - currentBalance).toLocaleString()} ZiGold\n\n💡 Hãy đi săn bắn hoặc chơi các trò khác để kiếm thêm ZiGold!`);
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
    console.error("Wheel command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi chơi wheel. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}