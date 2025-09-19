const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const lootboxUtil = require("../../utils/lootboxUtil.js");

const blank = '⬜'; // Biểu tượng khoảng trống
const normalBox = '📦'; // Biểu tượng lootbox thường
const boxShake = '🎁'; // Biểu tượng hộp lắc (động hình trong Discord với emoji tùy chỉnh)
const boxOpen = '✨'; // Biểu tượng hộp đã mở
const fabledBox = '🌟'; // Biểu tượng lootbox huyền thoại
const fboxShake = '💫'; // Hộp huyền thoại lắc
const fboxOpen = '🎆'; // Hộp huyền thoại đã mở

const maxBoxes = 100;
const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const gemEmoji = "💎"; // Biểu tượng đá quý

module.exports.data = {
    name: "lootbox",
    description: "Mở lootbox để nhận rewards ngẫu nhiên! Kiểm tra inventory bằng /zigold",
    type: 1,
    options: [
        {
            type: 3,
            name: "count",
            description: "Số lượng lootbox hoặc loại: [số, 'all', 'fabled']",
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

        const countOption = interaction.options.getString("count");
        
        if (countOption && !isNaN(parseInt(countOption))) {
            // Mở số lượng hộp cụ thể
            await openMultiple(interaction, parseInt(countOption), DataBase, ZiRank);
        } else if (countOption && countOption.toLowerCase() === 'all') {
            // Mở tất cả các hộp
            await openAllBoxes(interaction, DataBase, ZiRank);
        } else if (countOption && ['f', 'fabled'].includes(countOption.toLowerCase())) {
            // Mở hộp huyền thoại
            await openFabledBox(interaction, DataBase, ZiRank);
        } else {
            // Mở một hộp duy nhất
            await openBox(interaction, DataBase, ZiRank);
        }

    } catch (error) {
        console.error("Error in lootbox command:", error);
        await handleCommandError(interaction, error);
    }
};

async function handleInitializationError(interaction, isDatabaseError) {
    const errorEmbed = new EmbedBuilder()
        .setTitle(`⚠️ ✨ Khởi tạo hệ thống`)
        .setColor("#FFD700")
        .setDescription(
            isDatabaseError 
            ? `🔄 **Database đang khởi tạo...**\n\n✨ Vui lòng đợi vài giây rồi thử lại!`
            : `🔄 **Hệ thống ZiRank đang khởi tạo...**\n\n✨ Vui lòng đợi vài giây rồi thử lại!`
        )
        .setFooter({ 
            text: "Hệ thống sẽ sẵn sàng trong giây lát!", 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

async function openBox(interaction, DataBase, ZiRank) {
    const userId = interaction.user.id;
    const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

    // Check if user has lootboxes
    const userDB = await DataBase.ZiUser.findOne({ userID: userId });
    
    if (!userDB || (userDB.lootboxes || 0) <= 0) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không có lootbox!")
            .setColor("#FF4757")
            .setDescription(`**${userName}**, bạn không có lootbox nào!\n\n🎯 Hãy hunt animals để có cơ hội nhận lootbox!`)
            .setFooter({ 
                text: "Sử dụng /hunt để có cơ hội nhận lootbox!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Deduct one lootbox
    const updateResult = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId, lootboxes: { $gt: 0 } },
        { $inc: { lootboxes: -1 } },
        { new: true }
    );

    if (!updateResult) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không thể mở lootbox!")
            .setColor("#FF4757")
            .setDescription("Có lỗi xảy ra khi mở lootbox. Vui lòng thử lại!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Generate random reward
    const reward = lootboxUtil.generateRandomReward(1);
    const firstReward = reward.rewards[0];

    // Apply rewards to user
    await applyRewards(DataBase, ZiRank, userId, reward, interaction.user);

    // Create animated messages
    const text1 = `${blank} **| ${userName}** mở một lootbox\n${boxShake} **|** và tìm thấy...`;
    const text2 = `${firstReward.emoji} **| ${userName}** mở một lootbox\n${boxOpen} **|** và tìm thấy **${firstReward.displayName}**!\n\n💰 **Reward:** +${firstReward.zigoldReward.toLocaleString()} ${zigoldEmoji} ZiGold`;

    await interaction.reply(text1);
    setTimeout(async () => {
        try {
            await interaction.editReply(text2);
        } catch (error) {
            console.error("Error editing lootbox message:", error);
        }
    }, 3000);
}

async function openMultiple(interaction, count, DataBase, ZiRank) {
    if (count > maxBoxes) count = maxBoxes;
    if (count <= 0) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Số lượng không hợp lệ!")
            .setColor("#FF4757")
            .setDescription("Bạn cần mở ít nhất 1 lootbox!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const userId = interaction.user.id;
    const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

    // Check if user has enough lootboxes
    const userDB = await DataBase.ZiUser.findOne({ userID: userId });
    
    if (!userDB || (userDB.lootboxes || 0) < count) {
        const availableBoxes = userDB?.lootboxes || 0;
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không đủ lootbox!")
            .setColor("#FF4757")
            .setDescription(`**${userName}**, bạn chỉ có **${availableBoxes}** lootbox!\n\nBạn cần **${count}** lootbox để thực hiện lệnh này.`)
            .setFooter({ 
                text: "Sử dụng /hunt để có cơ hội nhận thêm lootbox!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Deduct lootboxes
    const updateResult = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId, lootboxes: { $gte: count } },
        { $inc: { lootboxes: -count } },
        { new: true }
    );

    if (!updateResult) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không thể mở lootbox!")
            .setColor("#FF4757")
            .setDescription("Có lỗi xảy ra khi mở lootbox. Vui lòng thử lại!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Generate multiple rewards
    const reward = lootboxUtil.generateRandomReward(count);

    // Apply rewards to user
    await applyRewards(DataBase, ZiRank, userId, reward, interaction.user);

    // Create reward text
    let rewardText = '';
    let totalZigold = 0;
    
    for (const rewardItem of reward.rewards) {
        rewardText += `${rewardItem.emoji}${rewardItem.count > 1 ? rewardItem.count : ''} `;
        totalZigold += rewardItem.zigoldReward * rewardItem.count;
    }

    const text1 = `${blank} **| ${userName}** mở ${count} lootboxes\n${boxShake} **|** và tìm thấy...`;
    const text2 = `${blank} **| ${userName}** mở ${count} lootboxes\n${boxOpen} **|** và tìm thấy: ${rewardText}\n\n💰 **Tổng ZiGold:** +${totalZigold.toLocaleString()} ${zigoldEmoji}`;

    await interaction.reply(text1);
    setTimeout(async () => {
        try {
            await interaction.editReply(text2);
        } catch (error) {
            console.error("Error editing multiple lootbox message:", error);
        }
    }, 3000);
}

async function openAllBoxes(interaction, DataBase, ZiRank) {
    const userId = interaction.user.id;
    
    const userDB = await DataBase.ZiUser.findOne({ userID: userId });
    if (!userDB || (userDB.lootboxes || 0) <= 0) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không có lootbox!")
            .setColor("#FF4757")
            .setDescription("Bạn không có lootbox nào để mở!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    let boxcount = userDB.lootboxes;
    if (boxcount > maxBoxes) boxcount = maxBoxes;

    await openMultiple(interaction, boxcount, DataBase, ZiRank);
}

async function openFabledBox(interaction, DataBase, ZiRank) {
    const userId = interaction.user.id;
    const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

    // Check if user has fabled lootboxes
    const userDB = await DataBase.ZiUser.findOne({ userID: userId });
    
    if (!userDB || (userDB.fabledLootboxes || 0) <= 0) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không có Fabled lootbox!")
            .setColor("#FF4757")
            .setDescription(`**${userName}**, bạn không có Fabled lootbox nào!\n\n${fabledBox} Fabled lootbox là phần thưởng đặc biệt rất hiếm!`)
            .setFooter({ 
                text: "Fabled lootbox chỉ có thể nhận được từ các event đặc biệt!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Deduct one fabled lootbox
    const updateResult = await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId, fabledLootboxes: { $gt: 0 } },
        { $inc: { fabledLootboxes: -1 } },
        { new: true }
    );

    if (!updateResult) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Không thể mở Fabled lootbox!")
            .setColor("#FF4757")
            .setDescription("Có lỗi xảy ra khi mở Fabled lootbox. Vui lòng thử lại!");
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Generate fabled reward (higher tier)
    const reward = lootboxUtil.generateFabledReward(1);
    const firstReward = reward.rewards[0];

    // Apply rewards to user
    await applyRewards(DataBase, ZiRank, userId, reward, interaction.user);

    // Create animated messages for fabled box
    const text1 = `${blank} **| ${userName}** mở một Fabled lootbox\n${fboxShake} **|** và tìm thấy...`;
    const text2 = `${firstReward.emoji} **| ${userName}** mở một Fabled lootbox\n${fboxOpen} **|** và tìm thấy **${firstReward.displayName}**!\n\n💰 **Reward:** +${firstReward.zigoldReward.toLocaleString()} ${zigoldEmoji} ZiGold\n✨ **XP:** +${firstReward.xpReward || 0}`;

    await interaction.reply(text1);
    setTimeout(async () => {
        try {
            await interaction.editReply(text2);
        } catch (error) {
            console.error("Error editing fabled lootbox message:", error);
        }
    }, 3000);
}

async function applyRewards(DataBase, ZiRank, userId, reward, user) {
    // Calculate total ZiGold and XP rewards
    let totalZigold = 0;
    let totalXP = 0;

    for (const rewardItem of reward.rewards) {
        totalZigold += rewardItem.zigoldReward * rewardItem.count;
        totalXP += (rewardItem.xpReward || 0) * rewardItem.count;
    }

    // Apply ZiGold rewards directly to database
    await DataBase.ZiUser.findOneAndUpdate(
        { userID: userId },
        { $inc: { coin: totalZigold } },
        { upsert: true }
    );

    // Apply XP rewards through ZiRank system
    if (totalXP > 0) {
        await ZiRank.execute({ 
            user: user, 
            XpADD: totalXP,
            CoinADD: 0 // We already handled coins above
        });
    }
}

async function handleCommandError(interaction, error) {
    console.error("Lootbox command error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại!");
    
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({ embeds: [errorEmbed] });
    } else {
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}