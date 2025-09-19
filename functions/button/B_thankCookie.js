const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");

const cookieEmoji = "🍪"; // Cookie emoji
const heartEmoji = "💖"; // Heart emoji
const sparkleEmoji = "✨"; // Sparkle emoji
const zigoldEmoji = "🪙"; // ZiGold emoji

module.exports.data = {
    name: "thank_cookie",
    type: "button",
};

/**
 * @param { object } params - Parameters object
 * @param { import("discord.js").ButtonInteraction } params.interaction - interaction
 * @param { object } params.lang - language object
 */
module.exports.execute = async ({ interaction, lang }) => {
    let user = null; // Declare in function scope for error logging
    try {
        // Get user from interaction (works for both guild and DM interactions)
        user = interaction.user || interaction.member?.user;
        if (!user) {
            console.error(`[THANKS_COOKIE_ERROR] No user found in interaction`);
            return;
        }
        
        
        // For button interactions, we need to defer the update to prevent timeout
        await interaction.deferUpdate();
        
        const ZiRank = useFunctions().get("ZiRank");
        const DataBase = useDB();

        // Validate that required services are available
        if (!DataBase || !DataBase.ZiUser || !ZiRank) {
            console.error('Thank cookie - Missing required services');
            return await interaction.followUp({ 
                content: "❌ Hệ thống đang khởi tạo, vui lòng thử lại sau!", 
                ephemeral: true 
            });
        }

        // Parse cookieId from embed footer
        const embed = interaction.message.embeds[0];
        if (!embed || !embed.footer || !embed.footer.text) {
            console.error('Thank cookie - No embed or footer found');
            return await interaction.followUp({ 
                content: "❌ Không thể tìm thấy thông tin cookie!", 
                ephemeral: true 
            });
        }
        
        // Extract cookieId from footer text: "... • ID:cookieId • ZiBot"
        const footerMatch = embed.footer.text.match(/ID:([^•]+)/);
        if (!footerMatch) {
            console.error('Thank cookie - No cookie ID found in footer');
            return await interaction.followUp({ 
                content: "❌ Cookie ID không hợp lệ!", 
                ephemeral: true 
            });
        }
        
        const cookieId = footerMatch[1].trim();
        const thankerId = user.id;
        
        
        // Parse cookieId format: timestamp_giverIdSuffix_receiverIdSuffix  
        const cookieParts = cookieId.split('_');
        if (cookieParts.length !== 3) {
            console.error('Thank cookie - Invalid cookie ID format');
            return await interaction.followUp({ 
                content: "❌ Format cookie ID không đúng!", 
                ephemeral: true 
            });
        }
        
        const [timestamp, giverIdSuffix, receiverIdSuffix] = cookieParts;
        
        // Verify receiver by checking if their ID ends with the suffix
        if (!thankerId.endsWith(receiverIdSuffix)) {
            return await interaction.followUp({ 
                content: "❌ Bạn không phải người nhận cookie này!", 
                ephemeral: true 
            });
        }
        
        
        // Find the giver - simplified approach
        let giverId = null;
        
        // Try to get all guild members and find the giver
        try {
            const guild = interaction.guild;
            if (guild) {
                await guild.members.fetch(); // Fetch all members
                const members = guild.members.cache;
                
                // Find member whose ID ends with giverIdSuffix
                const possibleGivers = members.filter(member => 
                    member.id.endsWith(giverIdSuffix) && 
                    !member.user.bot && 
                    member.id !== thankerId
                );
                
                if (possibleGivers.size === 1) {
                    giverId = possibleGivers.first().id;
                } else if (possibleGivers.size > 1) {
                    // If multiple matches, pick the first one (rare case)
                    giverId = possibleGivers.first().id;
                }
            }
        } catch (guildError) {
            // Guild member fetch failed, will try database fallback
        }
        
        // Fallback: search database if guild lookup failed
        if (!giverId) {
            const possibleGivers = await DataBase.ZiUser.find({
                userID: { $regex: giverIdSuffix + '$' }
            }).limit(5);
            
            if (possibleGivers.length > 0) {
                // Filter out the thanker and find most likely giver
                const validGivers = possibleGivers.filter(user => user.userID !== thankerId);
                if (validGivers.length > 0) {
                    giverId = validGivers[0].userID;
                }
            }
        }
        
        if (!giverId) {
            console.error('Thank cookie - Could not find giver');
            return await interaction.followUp({ 
                content: "❌ Không thể tìm thấy người tặng cookie! Có thể cookie đã quá cũ.", 
                ephemeral: true 
            });
        }

        // Check if trying to thank themselves (shouldn't happen but safety check)
        if (giverId === thankerId) {
            return await interaction.followUp({ 
                content: "❌ Bạn không thể cảm ơn chính mình!", 
                ephemeral: true 
            });
        }
        
        // Give small reward to both giver and thanker for positive interaction (atomic check)
        const THANK_REWARD = 2; // Small ZiGold reward
        const THANK_XP = 1; // Small XP reward


        // First, ensure thanker exists in database
        await DataBase.ZiUser.findOneAndUpdate(
            { userID: thankerId },
            {
                $setOnInsert: {
                    userID: thankerId,
                    name: user.username,
                    xp: 1,
                    level: 1,
                    coin: 1,
                    thankedCookies: []
                }
            },
            { upsert: true }
        );
        
        // Atomic check: only add to thankedCookies if not already present
        const thankResult = await DataBase.ZiUser.updateOne(
            { 
                userID: thankerId,
                thankedCookies: { $ne: cookieId }
            },
            {
                $addToSet: { thankedCookies: cookieId }
            }
        );
        
        // If no document was modified, user already thanked this cookie
        if (thankResult.modifiedCount === 0) {
            return await interaction.followUp({ 
                content: "❌ Bạn đã cảm ơn cookie này rồi!", 
                ephemeral: true 
            });
        }
        
        
        // Award ZiGold to both users (only after successful thank recording)
        await DataBase.ZiUser.updateOne(
            { userID: thankerId },
            { $inc: { coin: THANK_REWARD } }
        );

        // Ensure giver exists and reward them
        await DataBase.ZiUser.findOneAndUpdate(
            { userID: giverId },
            {
                $inc: { coin: THANK_REWARD },
                $setOnInsert: {
                    userID: giverId,
                    name: "Unknown User", // Will be updated when they use the bot
                    xp: 1,
                    level: 1
                }
            },
            { upsert: true }
        );

        // Apply XP to thanker
        await ZiRank.execute({ 
            user: user, 
            XpADD: THANK_XP,
            CoinADD: 0
        });

        // Get giver's user object
        let giverUser;
        try {
            giverUser = await interaction.client.users.fetch(giverId);
        } catch (error) {
            giverUser = { username: "Unknown User", displayAvatarURL: () => interaction.client.user.displayAvatarURL() };
        }

        const thankEmbed = new EmbedBuilder()
            .setTitle(`${heartEmoji} Cảm ơn đã gửi! ${sparkleEmoji}`)
            .setColor("#FF69B4")
            .setDescription(`**${user.username}** đã cảm ơn **${giverUser.username}** vì chiếc cookie ngon lành!\n\n${cookieEmoji} Kindness begets kindness! ${heartEmoji}`)
            .addFields({
                name: `${zigoldEmoji} Bonus Rewards`,
                value: `Cả hai đều nhận **+${THANK_REWARD}** ZiGold cho sự tử tế!`,
                inline: false
            })
            .setFooter({ 
                text: "💕 Spreading positivity in the community!", 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Disable the button after use - create proper ButtonBuilder from existing component
        let updatedComponents = [];
        if (interaction.message.components?.[0]?.components?.[0]) {
            try {
                const originalButton = interaction.message.components[0].components[0];
                const disabledButton = ButtonBuilder.from(originalButton)
                    .setDisabled(true)
                    .setLabel("✅ Đã cảm ơn");
                    
                const actionRow = new ActionRowBuilder().addComponents(disabledButton);
                updatedComponents = [actionRow];
            } catch (buttonError) {
                updatedComponents = []; // Remove components if we can't disable
            }
        }

        // Update the original message with thank response
        await interaction.editReply({ 
            embeds: [thankEmbed],
            components: updatedComponents
        });
        

        // Try to notify the giver via DM
        try {
            if (giverUser && !giverUser.bot && giverUser.username !== "Unknown User") {
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${heartEmoji} Bạn được cảm ơn! ${sparkleEmoji}`)
                    .setColor("#FF69B4")
                    .setDescription(`**${user.username}** đã cảm ơn bạn vì chiếc cookie!\n\n${zigoldEmoji} Bạn nhận được **+${THANK_REWARD}** ZiGold bonus!`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: "ZiBot Cookie System • Kindness Rewards" })
                    .setTimestamp();

                await giverUser.send({ embeds: [dmEmbed] });
            }
        } catch (dmError) {
            // DM failed, but that's okay - many users have DMs disabled
        }

    } catch (error) {
        console.error('Thank cookie error:', error.message);
        
        // Since we used deferUpdate(), we need to use followUp for error messages
        try {
            await interaction.followUp({ 
                content: "❌ Có lỗi xảy ra khi gửi lời cảm ơn. Vui lòng thử lại!", 
                ephemeral: true 
            });
        } catch (followUpError) {
            console.error('Thank cookie - Failed to send error message via followUp:', followUpError.message);
            
            // Last resort: try editReply (might work if deferUpdate was successful)
            try {
                await interaction.editReply({ 
                    content: "❌ Có lỗi xảy ra khi gửi lời cảm ơn. Vui lòng thử lại!",
                    components: []
                });
            } catch (editError) {
                console.error('Thank cookie - Failed to send error message via editReply:', editError.message);
            }
        }
    }
};