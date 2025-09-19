const { EmbedBuilder } = require("discord.js");

module.exports.data = {
    name: "cancel_give",
    type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
    try {
        // Extract user ID from custom ID and verify ownership
        const customIdParts = interaction.customId.split(':');
        const authorId = customIdParts[1];
        const transactionId = customIdParts[2] || 'unknown';
        
        if (interaction.user.id !== authorId) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Unauthorized")
                .setColor("#FF4757")
                .setDescription("Bạn không thể sử dụng button này!");
            return await interaction.update({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }

        // Create cancellation embed
        const cancelEmbed = new EmbedBuilder()
            .setTitle("❌ Give Cancelled")
            .setColor("#9E9E9E")
            .setDescription("**Bạn đã hủy việc tặng animal.**\n\n🎁 Không có animal nào được chuyển.\n🦁 Collection của bạn vẫn an toàn!\n\n💡 Bạn có thể sử dụng lệnh `/giveanimal` bất cứ lúc nào để tặng animals cho bạn bè!")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Chia sẻ là quan tâm! • TX: ${transactionId.substr(-8)}`,
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Use interaction.update instead of interaction.reply to properly update the original message
        await interaction.update({ 
            embeds: [cancelEmbed], 
            components: [] // Remove all buttons
        });

    } catch (error) {
        console.error("Error in cancel_give:", error);
        await handleButtonError(interaction, error);
    }
};

async function handleButtonError(interaction, error) {
    console.error("Cancel give button error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi hủy tặng. Vui lòng thử lại!");
    
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