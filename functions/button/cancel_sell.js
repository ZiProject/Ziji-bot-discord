const { EmbedBuilder } = require("discord.js");

module.exports.data = {
    name: "cancel_sell",
    type: "button",
};

/**
 * @param { object } button - object button
 * @param { import("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import("../../lang/vi.js") } button.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
    try {
        // User verification is handled by Discord automatically for interactions

        // Create cancellation embed
        const cancelEmbed = new EmbedBuilder()
            .setTitle("❌ Sale Cancelled")
            .setColor("#9E9E9E")
            .setDescription("**Bạn đã hủy việc bán animals.**\n\n💰 Không có animals nào được bán.\n🦁 Collection của bạn vẫn an toàn!")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Bạn có thể sử dụng /sell bất cứ lúc nào để bán animals!`,
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Use interaction.update instead of interaction.reply to properly update the original message
        await interaction.update({ 
            embeds: [cancelEmbed], 
            components: [] // Remove all buttons
        });

    } catch (error) {
        console.error("Error in cancel_sell:", error);
        await handleButtonError(interaction, error);
    }
};

async function handleButtonError(interaction, error) {
    console.error("Cancel sell button error:", error);
    const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Lỗi")
        .setColor("#FF0000")
        .setDescription("Có lỗi xảy ra khi hủy bán. Vui lòng thử lại!");
    
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