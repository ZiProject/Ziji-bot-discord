const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");

const cookieEmoji = "🍪"; // Biểu tượng cookie
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const heartEmoji = "💖"; // Biểu tượng trái tim
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const giftEmoji = "🎁"; // Biểu tượng quà tặng
const starEmoji = "⭐"; // Biểu tượng ngôi sao

const COOKIE_COOLDOWN = 10 * 1000; // 10 giây giữa các lần tặng cookie
const COOKIE_ZIGOLD_REWARD = 5; // Phần thưởng ZiGold cho việc tặng cookie
const COOKIE_XP_REWARD = 2; // Phần thưởng XP cho việc tặng cookie
const SPECIAL_COOKIE_CHANCE = 0.05; // 5% cơ hội cho cookie đặc biệt

// Tin nhắn cookie thú vị
const COOKIE_MESSAGES = [
    "đã tặng bạn một chiếc cookie ngọt ngào!",
    "đã gửi cho bạn một cookie ấm áp!",
    "đã chia sẻ cookie yêu thích với bạn!",
    "đã làm cookie đặc biệt dành cho bạn!",
    "đã nướng cookie tươi cho bạn!",
    "đã tặng bạn cookie may mắn!",
    "đã gửi cookie tình bạn cho bạn!"
];

const SPECIAL_COOKIE_MESSAGES = [
    "đã tặng bạn một chiếc ✨GOLDEN COOKIE✨ hiếm có!",
    "đã làm ra một 🌟MAGIC COOKIE🌟 đặc biệt cho bạn!",
    "đã nướng một 🎯LUCKY COOKIE🎯 tuyệt vời cho bạn!",
    "đã tạo ra một 💎DIAMOND COOKIE💎 quý hiếm cho bạn!"
];

module.exports.data = {
    name: "cookie",
    description: "Tặng cookie ngọt ngào cho bạn bè và nhận phần thưởng!",
    type: 1,
    options: [
        {
            type: 6,
            name: "user",
            description: "Người bạn muốn tặng cookie",
            required: false,
        },
    ],
    integration_types: [0, 1], // Ứng dụng máy chủ + Ứng dụng người dùng  
    contexts: [0, 1, 2], // Máy chủ + Tin nhắn riêng + Kênh riêng tư
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

        // Kiểm tra xem cơ sở dữ liệu và các hàm được khởi tạo đúng cách
        if (!DataBase || !DataBase.ZiUser || !ZiRank) {
            return await handleInitializationError(interaction, !DataBase);
        }

        const targetUser = interaction.options.getUser("user");
        
        if (targetUser) {
            // Tặng cookie cho người dùng khác
            await giveCookie(interaction, targetUser, DataBase, ZiRank);
        } else {
            // Hiển thị thống kê cookie
            await showCookieStats(interaction, DataBase);
        }

    } catch (error) {
        console.error("Error in cookie command:", error);
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

async function giveCookie(interaction, targetUser, DataBase, ZiRank) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;
    const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
    const targetName = targetUser.member?.displayName ?? targetUser.globalName ?? targetUser.username;
    const now = new Date();

    // Check if trying to give cookie to self
    if (userId === targetId) {
        const selfErrorEmbed = new EmbedBuilder()
            .setTitle(`${cookieEmoji} Không thể tự tặng cookie!`)
            .setColor("#FF6B9D")
            .setDescription(`**${userName}**, bạn không thể tự tặng cookie cho chính mình!\n\n${heartEmoji} Hãy chia sẻ cookie với bạn bè nhé!`)
            .setFooter({ 
                text: "Cookie được tạo ra để chia sẻ tình yêu thương!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [selfErrorEmbed], ephemeral: true });
    }

    // Check if target is a bot
    if (targetUser.bot) {
        const botErrorEmbed = new EmbedBuilder()
            .setTitle(`${cookieEmoji} Bot không cần cookie!`)
            .setColor("#FF6B9D")
            .setDescription(`**${userName}**, bot không thể ăn cookie!\n\n🤖 Hãy tặng cookie cho con người thật nhé!`)
            .setFooter({ 
                text: "Bot chỉ cần điện năng thôi!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
    }

    // Generate more robust unique cookie ID for this transaction
    const timestamp = now.getTime().toString().slice(-10); // Last 10 digits of timestamp for better uniqueness
    const cookieId = `${timestamp}_${userId.slice(-10)}_${targetId.slice(-10)}`; // Use 10 chars for better uniqueness
    const cooldownThreshold = new Date(now.getTime() - COOKIE_COOLDOWN);

    // Determine if special cookie
    const isSpecialCookie = Math.random() < SPECIAL_COOKIE_CHANCE;
    const zigoldBonus = isSpecialCookie ? COOKIE_ZIGOLD_REWARD * 3 : COOKIE_ZIGOLD_REWARD;
    const xpBonus = isSpecialCookie ? COOKIE_XP_REWARD * 2 : COOKIE_XP_REWARD;

    // Atomic cooldown check and update giver's stats
    const updateResult = await DataBase.ZiUser.findOneAndUpdate(
        { 
            userID: userId,
            $or: [
                { lastCookie: { $lt: cooldownThreshold } },
                { lastCookie: { $exists: false } }
            ]
        },
        {
            $inc: { 
                cookiesGiven: 1,
                coin: zigoldBonus
            },
            $set: { lastCookie: now },
            $setOnInsert: {
                userID: userId,
                name: userName,
                xp: 1,
                level: 1,
                cookiesReceived: 0
            }
        },
        { upsert: true, new: true }
    );
    
    // If no document was modified, user is on cooldown
    if (!updateResult) {
        // Get current user data to calculate remaining cooldown
        const userDB = await DataBase.ZiUser.findOne({ userID: userId });
        const timeDiff = now.getTime() - new Date(userDB.lastCookie).getTime();
        const timeLeft = COOKIE_COOLDOWN - timeDiff;
        const secondsLeft = Math.ceil(timeLeft / 1000);
        
        const cooldownEmbed = new EmbedBuilder()
            .setTitle(`⏰ ${cookieEmoji} Cookie Cooldown`)
            .setColor("#FF6B9D")
            .setDescription(`**${userName}**, bạn đã tặng cookie gần đây!\n\n🕐 Hãy đợi **${secondsLeft} giây** để tặng cookie tiếp theo.`)
            .setFooter({ 
                text: "Làm cookie cần thời gian!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
    }

    // Update receiver's stats
    await DataBase.ZiUser.findOneAndUpdate(
        { userID: targetId },
        {
            $inc: { cookiesReceived: 1 },
            $setOnInsert: {
                userID: targetId,
                name: targetName,
                xp: 1,
                level: 1,
                coin: 0,
                cookiesGiven: 0
            }
        },
        { upsert: true }
    );

    // Apply XP bonus through ZiRank
    await ZiRank.execute({ 
        user: interaction.user, 
        XpADD: xpBonus,
        CoinADD: 0 // We already handled coins above
    });

    // Choose random message
    const messages = isSpecialCookie ? SPECIAL_COOKIE_MESSAGES : COOKIE_MESSAGES;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Create success embed
    const cookieEmbed = new EmbedBuilder()
        .setTitle(`${cookieEmoji} ${isSpecialCookie ? '✨ Special Cookie! ✨' : 'Cookie Delivered!'} ${giftEmoji}`)
        .setColor(isSpecialCookie ? "#FFD700" : "#8B4513")
        .setDescription(`**${userName}** ${randomMessage}\n\n${targetUser} ${heartEmoji}`)
        .addFields(
            {
                name: `${giftEmoji} Giver Rewards`,
                value: `${zigoldEmoji} **+${zigoldBonus}** ZiGold\n${starEmoji} **+${xpBonus}** XP`,
                inline: true
            },
            {
                name: `${cookieEmoji} Cookie Count`,
                value: `**Given:** ${updateResult.cookiesGiven}\n**Received:** ${updateResult.cookiesReceived || 0}`,
                inline: true
            }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `${isSpecialCookie ? '🌟 Special cookie bonus!' : '💖 Spread the love with cookies!'} • ID:${cookieId} • ZiBot`,
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    if (isSpecialCookie) {
        cookieEmbed.setImage("https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"); // Optional: cookie gif
    }

    // Create button for receiver to thank (only for receiver)
    const thankButton = new ButtonBuilder()
        .setCustomId("thank_cookie")
        .setLabel("🙏 Cảm ơn!")
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(thankButton);

    // Send public cookie message WITH button in guild
    await interaction.reply({ 
        embeds: [cookieEmbed],
        components: [actionRow]
    });

    // Try to send DM to receiver with thanks button
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle(`${cookieEmoji} Bạn nhận được cookie! ${giftEmoji}`)
            .setColor("#8B4513")
            .setDescription(`**${userName}** ${randomMessage}`)
            .addFields(
                {
                    name: `${sparkleEmoji} Cookie Message`,
                    value: `"${heartEmoji} Enjoy your delicious cookie! ${heartEmoji}"`,
                    inline: false
                },
                {
                    name: `${giftEmoji} Làm gì tiếp theo?`,
                    value: `Hãy thưởng thức cookie ngon lành của bạn! ${heartEmoji}`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `ID:${cookieId} • ZiBot Cookie Delivery Service`,
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await targetUser.send({ 
            embeds: [dmEmbed]
            // Removed components (button) from DM as requested
        });
        console.log(`Successfully sent cookie notification DM to ${targetUser.username}`);
    } catch (dmError) {
        console.log(`Could not DM cookie notification to ${targetUser.username}: ${dmError.message}`);
        console.log(`Note: ${targetUser.username} won't be able to thank for this cookie as DMs are disabled`);
    }
}

async function showCookieStats(interaction, DataBase) {
    const userId = interaction.user.id;
    const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

    const userDB = await DataBase.ZiUser.findOne({ userID: userId });
    const cookiesGiven = userDB?.cookiesGiven || 0;
    const cookiesReceived = userDB?.cookiesReceived || 0;
    const totalCookies = cookiesGiven + cookiesReceived;

    // Calculate cookie rank
    let cookieRank = "🥉 Cookie Newbie";
    let rankDescription = "Bạn mới bắt đầu hành trình cookie!";
    
    if (totalCookies >= 100) {
        cookieRank = "🏆 Cookie Master";
        rankDescription = "Bạn là bậc thầy về cookie!";
    } else if (totalCookies >= 50) {
        cookieRank = "🥇 Cookie Expert";
        rankDescription = "Bạn là chuyên gia cookie!";
    } else if (totalCookies >= 25) {
        cookieRank = "🥈 Cookie Enthusiast";
        rankDescription = "Bạn rất yêu thích cookie!";
    } else if (totalCookies >= 10) {
        cookieRank = "🍪 Cookie Lover";
        rankDescription = "Bạn đang say mê cookie!";
    }

    const statsEmbed = new EmbedBuilder()
        .setTitle(`${cookieEmoji} Cookie Stats của ${userName}`)
        .setColor("#8B4513")
        .setDescription(`${sparkleEmoji} ${rankDescription}\n\n**Tổng Cookie Activity:** ${totalCookies}`)
        .addFields(
            {
                name: `${giftEmoji} Cookies Đã Tặng`,
                value: `**${cookiesGiven}** cookies`,
                inline: true
            },
            {
                name: `${heartEmoji} Cookies Đã Nhận`,
                value: `**${cookiesReceived}** cookies`,
                inline: true
            },
            {
                name: `${starEmoji} Cookie Rank`,
                value: cookieRank,
                inline: true
            }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `💡 Sử dụng /cookie @user để tặng cookie! • ZiBot Cookie System`,
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();

    // Add motivational message based on stats
    if (cookiesGiven === 0) {
        statsEmbed.addFields({
            name: `${sparkleEmoji} Tip`,
            value: `Hãy tặng cookie đầu tiên cho ai đó để nhận ${zigoldEmoji} ZiGold và ${starEmoji} XP!`,
            inline: false
        });
    } else if (cookiesGiven < 5) {
        statsEmbed.addFields({
            name: `${sparkleEmoji} Keep Going!`,
            value: `Tuyệt vời! Hãy tiếp tục chia sẻ yêu thương qua cookies!`,
            inline: false
        });
    }

    await interaction.reply({ embeds: [statsEmbed] });
}

async function handleCommandError(interaction, error) {
    console.error("Cookie command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi thực hiện lệnh cookie. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}